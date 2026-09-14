/**
 * Physical Verification Service Abstraction
 * 
 * Provides a clean interface for verifying that physical basket contents
 * match the customer's paid digital order before exit gate clearance.
 * 
 * Designed to support Manual Staff Basket Verification (MVP)
 * and seamless drop-in of automated RFID readers in the future.
 */

class PhysicalVerificationService {
  /**
   * Verify physical items against expected order items
   * @param {Array} expectedItems - Array of { name, barcode, quantity, price, productId }
   * @param {Object|Array} physicalInput - Input from staff checklist or RFID scan
   * @returns {Object} Verification result
   */
  async verifyBasket(expectedItems, physicalInput) {
    throw new Error('Method verifyBasket() must be implemented by subclass.');
  }
}

/**
 * MVP Service: Manual Staff-Assisted Basket Verification
 */
class ManualBasketVerificationService extends PhysicalVerificationService {
  /**
   * Verifies manual staff basket count / checklist
   * @param {Array} expectedItems - Items recorded in the Exit Pass
   * @param {Object} physicalInput - { isConfirmed, verifiedItems, mismatchReason, notes }
   */
  async verifyBasket(expectedItems = [], physicalInput = {}) {
    // If staff explicitly confirms matching basket without granular item overrides
    if (physicalInput.isConfirmed === true && !physicalInput.verifiedItems) {
      const totalExpected = expectedItems.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
      return {
        success: true,
        matches: true,
        method: 'MANUAL_STAFF',
        expectedCount: totalExpected,
        verifiedCount: totalExpected,
        message: 'Physical basket matches paid digital order.'
      };
    }

    // If staff reported an explicit mismatch
    if (physicalInput.hasMismatch === true || physicalInput.isConfirmed === false) {
      const reason = physicalInput.mismatchReason || 'Item mismatch detected. Staff verification required.';
      return {
        success: false,
        matches: false,
        method: 'MANUAL_STAFF',
        rejectionReason: 'ITEM_MISMATCH',
        message: reason
      };
    }

    // Item-by-item comparison if verifiedItems list provided
    const verifiedItems = physicalInput.verifiedItems || [];
    const expectedMap = new Map();
    let totalExpectedCount = 0;

    for (const item of expectedItems) {
      const key = String(item.barcode || item.productId || item.name).trim().toLowerCase();
      const qty = Number(item.quantity) || 1;
      expectedMap.set(key, {
        name: item.name,
        barcode: item.barcode,
        expectedQuantity: qty
      });
      totalExpectedCount += qty;
    }

    const verifiedMap = new Map();
    let totalVerifiedCount = 0;

    for (const vItem of verifiedItems) {
      const key = String(vItem.barcode || vItem.productId || vItem.name).trim().toLowerCase();
      const qty = Number(vItem.quantity) || 1;
      verifiedMap.set(key, {
        name: vItem.name,
        barcode: vItem.barcode,
        verifiedQuantity: qty
      });
      totalVerifiedCount += qty;
    }

    const mismatches = [];

    // Check expected items vs verified
    for (const [key, exp] of expectedMap.entries()) {
      const ver = verifiedMap.get(key);
      const verQty = ver ? ver.verifiedQuantity : 0;

      if (verQty !== exp.expectedQuantity) {
        mismatches.push({
          item: exp.name,
          barcode: exp.barcode,
          expected: exp.expectedQuantity,
          verified: verQty,
          type: verQty < exp.expectedQuantity ? 'MISSING_ITEM' : 'EXTRA_ITEM'
        });
      }
    }

    // Check for unexpected extra items in verified basket
    for (const [key, ver] of verifiedMap.entries()) {
      if (!expectedMap.has(key)) {
        mismatches.push({
          item: ver.name,
          barcode: ver.barcode,
          expected: 0,
          verified: ver.verifiedQuantity,
          type: 'EXTRA_ITEM'
        });
      }
    }

    if (mismatches.length > 0) {
      // Build neutral description (never accusing customer of theft)
      const firstMis = mismatches[0];
      let msg = 'Item mismatch detected. Staff verification required.';
      if (firstMis.expected > 0 && firstMis.type === 'MISSING_ITEM') {
        msg = `Item count mismatch. Expected: ${firstMis.item} × ${firstMis.expected}, Verified: ${firstMis.item} × ${firstMis.verified}. Staff verification required.`;
      } else {
        msg = 'Item mismatch detected. Staff verification required.';
      }

      return {
        success: false,
        matches: false,
        method: 'MANUAL_STAFF',
        expectedCount: totalExpectedCount,
        verifiedCount: totalVerifiedCount,
        mismatches,
        rejectionReason: 'ITEM_MISMATCH',
        message: msg
      };
    }

    return {
      success: true,
      matches: true,
      method: 'MANUAL_STAFF',
      expectedCount: totalExpectedCount,
      verifiedCount: totalVerifiedCount,
      message: 'Physical basket matches paid digital order.'
    };
  }
}

/**
 * Future Service: Automated RFID Gate Reader Verification
 * Ready for future production deployment without altering checkout or payment code.
 */
class RFIDBasketVerificationService extends PhysicalVerificationService {
  /**
   * Verifies RFID tag scanner readings at the exit portal
   * @param {Array} expectedItems - Items recorded in the Exit Pass
   * @param {Object} physicalInput - { rfidTags: Array<{ epc, barcode, name }> }
   */
  async verifyBasket(expectedItems = [], physicalInput = {}) {
    const detectedTags = physicalInput.rfidTags || [];
    
    // Group detected RFID tags by barcode or product identifier
    const detectedCounts = new Map();
    let totalDetected = 0;

    for (const tag of detectedTags) {
      const key = String(tag.barcode || tag.epc || tag.productId).trim();
      detectedCounts.set(key, (detectedCounts.get(key) || 0) + 1);
      totalDetected++;
    }

    const expectedCounts = new Map();
    let totalExpected = 0;

    for (const item of expectedItems) {
      const key = String(item.barcode || item.productId).trim();
      const qty = Number(item.quantity) || 1;
      expectedCounts.set(key, (expectedCounts.get(key) || 0) + qty);
      totalExpected += qty;
    }

    const discrepancies = [];

    // Verify each expected product
    for (const [key, expQty] of expectedCounts.entries()) {
      const actQty = detectedCounts.get(key) || 0;
      if (actQty !== expQty) {
        discrepancies.push({
          identifier: key,
          expected: expQty,
          detected: actQty
        });
      }
    }

    // Verify no extraneous tags detected
    for (const [key, actQty] of detectedCounts.entries()) {
      if (!expectedCounts.has(key)) {
        discrepancies.push({
          identifier: key,
          expected: 0,
          detected: actQty
        });
      }
    }

    if (discrepancies.length > 0) {
      return {
        success: false,
        matches: false,
        method: 'RFID',
        expectedCount: totalExpected,
        verifiedCount: totalDetected,
        discrepancies,
        rejectionReason: 'RFID_ITEM_MISMATCH',
        message: 'Item mismatch detected. Staff verification required.'
      };
    }

    return {
      success: true,
      matches: true,
      method: 'RFID',
      expectedCount: totalExpected,
      verifiedCount: totalDetected,
      message: 'RFID verification successful. All items match paid digital order.'
    };
  }
}

/**
 * Service Factory
 * @param {'MANUAL_STAFF' | 'RFID'} method 
 * @returns {PhysicalVerificationService}
 */
function getPhysicalVerificationService(method = 'MANUAL_STAFF') {
  if (method === 'RFID') {
    return new RFIDBasketVerificationService();
  }
  return new ManualBasketVerificationService();
}

module.exports = {
  PhysicalVerificationService,
  ManualBasketVerificationService,
  RFIDBasketVerificationService,
  getPhysicalVerificationService
};
