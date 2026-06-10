const THRESHOLD = 10;

function checkAlerts(previousFlights, currentFlights) {
  const prevMap = new Map((previousFlights || []).map(f => [f.id, f.price]));
  const alerts = [];

  for (const flight of currentFlights) {
    const prevPrice = prevMap.get(flight.id);
    if (prevPrice == null) continue;
    const change = flight.price - prevPrice;
    if (Math.abs(change) >= THRESHOLD) {
      alerts.push({
        airline: flight.airline,
        iataCode: flight.iataCode,
        route: `${flight.origin}→${flight.destination}`,
        flightId: flight.id,
        oldPrice: prevPrice,
        newPrice: flight.price,
        change: Math.round(change),
        percentChange: ((change / prevPrice) * 100).toFixed(1),
        direction: change < 0 ? 'down' : 'up',
        timestamp: new Date().toISOString(),
      });
    }
  }

  return alerts.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

module.exports = { checkAlerts };
