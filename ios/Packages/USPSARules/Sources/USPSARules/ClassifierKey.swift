import Foundation
import USPSADomain

// Used by UI code to compare/identify classifiers across the rolling-window
// and scenario passes. Matches src/lib/classifierKey.ts.
public func classifierKey(_ c: Classifier) -> String {
    "\(c.date):\(c.classifierCode):\(c.percent)"
}
