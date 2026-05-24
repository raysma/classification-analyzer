import Foundation
import USPSADomain

// MARK: M2 — port of src/lib/rules.ts and src/lib/projection.ts
//
// Intentionally empty in M1. Real implementations land in M2:
//   - bestSixOfRecentEight()
//   - mostRecentOverride() classifier-code dedup
//   - currentClassFromScores()
//   - requiredAverageForTarget() (Projection.swift)
//   - displayName helpers (DivisionFormatter.swift)

public enum USPSARules {}
