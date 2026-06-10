const axios = require('axios');

const AMADEUS_BASE = 'https://test.api.amadeus.com';
let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 30000) {
    return tokenCache.token;
  }
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.AMADEUS_CLIENT_ID,
    client_secret: process.env.AMADEUS_CLIENT_SECRET,
  });
  const res = await axios.post(`${AMADEUS_BASE}/v1/security/oauth2/token`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });
  tokenCache = {
    token: res.data.access_token,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  };
  return tokenCache.token;
}

const AIRCRAFT_MAP = {
  '77W': 'Boeing 777-300ER', '772': 'Boeing 777-200', '773': 'Boeing 777-300',
  '789': 'Boeing 787-9 Dreamliner', '788': 'Boeing 787-8 Dreamliner', '781': 'Boeing 787-10 Dreamliner',
  '763': 'Boeing 767-300', '764': 'Boeing 767-400ER', '762': 'Boeing 767-200',
  '359': 'Airbus A350-900', '351': 'Airbus A350-1000',
  '333': 'Airbus A330-300', '332': 'Airbus A330-200',
  '388': 'Airbus A380-800', '380': 'Airbus A380',
  '32Q': 'Airbus A321LR', '321': 'Airbus A321', '32A': 'Airbus A321neo',
  '320': 'Airbus A320', '319': 'Airbus A319',
  '738': 'Boeing 737-800', '7M9': 'Boeing 737 MAX 9',
};

const ALLIANCE_MAP = {
  AA: 'Oneworld', BA: 'Oneworld', IB: 'Oneworld', AY: 'Oneworld', QF: 'Oneworld', MH: 'Oneworld',
  DL: 'SkyTeam', AF: 'SkyTeam', KL: 'SkyTeam', VS: 'SkyTeam', KE: 'SkyTeam', ME: 'SkyTeam',
  UA: 'Star Alliance', LH: 'Star Alliance', SK: 'Star Alliance', SN: 'Star Alliance', OS: 'Star Alliance',
  NH: 'Star Alliance', CA: 'Star Alliance',
  N0: 'None', B6: 'None', EI: 'None', FI: 'None', DE: 'None', W6: 'None',
};

const AIRLINE_NAMES = {
  AA: 'American Airlines', BA: 'British Airways', IB: 'Iberia', AY: 'Finnair',
  DL: 'Delta Air Lines', AF: 'Air France', KL: 'KLM Royal Dutch', VS: 'Virgin Atlantic',
  UA: 'United Airlines', LH: 'Lufthansa', SK: 'SAS Scandinavian', OS: 'Austrian Airlines',
  N0: 'Norse Atlantic', B6: 'JetBlue Airways', EI: 'Aer Lingus', FI: 'Icelandair',
};

function formatDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  const h = parseInt(match?.[1] || 0);
  const m = parseInt(match?.[2] || 0);
  return `${h}h ${m}m`;
}

async function searchFlights(origin, destination, departDate, returnDate) {
  const token = await getToken();
  const res = await axios.get(`${AMADEUS_BASE}/v2/shopping/flight-offers`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: departDate,
      returnDate: returnDate,
      adults: 1,
      currencyCode: 'USD',
      max: 15,
    },
    timeout: 15000,
  });

  const now = new Date().toISOString();
  return res.data.data.map((offer, i) => {
    const out = offer.itineraries[0];
    const ret = offer.itineraries[1];
    const outSeg = out.segments[0];
    const retSeg = ret?.segments[0];
    const iata = outSeg.carrierCode;
    const stops = out.segments.length - 1;
    const stopAirport = stops > 0 ? out.segments[0].arrival.iataCode : null;
    const aircraftCode = outSeg.aircraft?.code || '';

    return {
      id: offer.id || `${iata}${i}`,
      airline: AIRLINE_NAMES[iata] || iata,
      iataCode: iata,
      alliance: ALLIANCE_MAP[iata] || 'None',
      origin,
      destination,
      outboundDeparture: outSeg.departure.at,
      outboundArrival: outSeg.arrival.at,
      returnDeparture: retSeg?.departure.at || null,
      returnArrival: retSeg?.arrival.at || null,
      flightDuration: formatDuration(out.duration),
      stops,
      stopAirport,
      aircraft: AIRCRAFT_MAP[aircraftCode] || aircraftCode || 'Unknown',
      price: parseFloat(offer.price.grandTotal),
      currency: offer.price.currency,
      awardsAvailable: false,
      estimatedMiles: null,
      notes: '',
      bookingUrl: `https://www.google.com/flights`,
      lastUpdated: now,
    };
  });
}

async function fetchAllFlights() {
  const routes = [
    ['EWR', 'LHR'],
    ['JFK', 'LHR'],
    ['JFK', 'LGW'],
  ];
  const depart = '2026-08-13';
  const ret = '2026-08-23';

  const results = await Promise.allSettled(
    routes.map(([o, d]) => searchFlights(o, d, depart, ret))
  );

  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

module.exports = { fetchAllFlights };
