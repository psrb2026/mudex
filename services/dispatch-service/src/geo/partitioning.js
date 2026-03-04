// services/dispatch-service/src/geo/partitioning.js
const h3 = require('h3-js');

class GeoPartitioner {
  constructor() {
    this.resolutions = {
      city: 7,      // ~5km² por célula
      neighborhood: 9,  // ~0.2km²
      block: 10     // ~0.05km²
    };
    this.partitions = new Map(); // H3 index -> DriverSet
  }

  /**
   * Indexa motorista na estrutura hierárquica
   * O(1) para inserção
   */
  indexDriver(driverId, lat, lng, metadata) {
    const h3Index = h3.latLngToCell(lat, lng, this.resolutions.neighborhood);
    
    if (!this.partitions.has(h3Index)) {
      this.partitions.set(h3Index, new DriverIndex());
    }
    
    const index = this.partitions.get(h3Index);
    index.add(driverId, {
      ...metadata,
      h3Index,
      lastUpdate: Date.now()
    });

    // Propaga para níveis superiores (eventual consistency)
    this.propagateToParent(h3Index, driverId, 'add');
  }

  /**
   * Busca candidatos em anel expandido
   * O(k) onde k = motoristas no raio, não O(n) total
   */
  findCandidates(centerLat, centerLng, maxRadius = 5000, limit = 50) {
    const centerH3 = h3.latLngToCell(centerLat, centerLng, this.resolutions.neighborhood);
    
    // Anéis concêntricos de H3: 0 (mesma célula), 1 (vizinhos), 2, etc.
    const rings = [
      h3.gridDisk(centerH3, 0),  // ~200m
      h3.gridDisk(centerH3, 1),  // ~600m
      h3.gridDisk(centerH3, 2),  // ~1.2km
      h3.gridDisk(centerH3, 3),  // ~2km
      h3.gridDisk(centerH3, 5),  // ~5km
    ];

    const candidates = [];
    
    for (const ring of rings) {
      for (const h3Index of ring) {
        const index = this.partitions.get(h3Index);
        if (!index) continue;

        // Query O(1) por célula
        const drivers = index.getAll();
        
        for (const driver of drivers) {
          if (this.isEligible(driver)) {
            candidates.push(driver);
            if (candidates.length >= limit * 2) break; // Buffer para scoring
          }
        }
        
        if (candidates.length >= limit * 2) break;
      }
      if (candidates.length >= limit * 2) break;
    }

    return candidates.slice(0, limit);
  }

  /**
   * Verifica elegibilidade com filtros rápidos O(1)
   */
  isEligible(driver) {
    // Filtros em ordem de custo computacional
    if (driver.isOnline !== true) return false;
    if (driver.hasActiveRide) return false;
    if (Date.now() - driver.lastUpdate > 30000) return false; // Stale
    if (driver.currentRideRequests >= 3) return false; // Já ocupado
    return true;
  }
}

/**
 * Índice local por célula H3
 * Usa Skip List para range queries eficientes
 */
class DriverIndex {
  constructor() {
    this.drivers = new Map(); // driverId -> metadata
    this.scoreIndex = new SkipList(); // ordenado por score pré-calculado
  }

  add(driverId, metadata) {
    this.drivers.set(driverId, metadata);
    // Mantém índice de score atualizado assincronamente
    setImmediate(() => this.updateScoreIndex(driverId, metadata));
  }

  getAll() {
    return Array.from(this.drivers.values());
  }
}