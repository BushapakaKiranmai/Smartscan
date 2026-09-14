import api from '../api/client';

/**
 * Authoritative Exit Pass Service
 * Connects directly to backend source-of-truth endpoints.
 */

/**
 * Gate scanner / staff verification service
 * Strictly burns the pass atomically on first successful verification.
 * 
 * @param {string} identifier - passId, uniquePassId, or 6-character shortcode
 * @param {object} options - optional gateTerminalId, branchId
 * @returns {Promise<object>} verification result
 */
export const verifyExitPass = async (identifier, options = {}) => {
  const cleanId = String(identifier || '').trim();
  const payload = {
    passId: cleanId,
    code: cleanId,
    shortCode: cleanId,
    gateTerminalId: options.gateTerminalId || 'GATE-01',
    branchId: options.branchId
  };

  return await api.post('/exit-passes/verify', payload);
};

/**
 * Retrieves the current authoritative Exit Pass state for an order or pass
 * Never marks a pass as USED just by reading.
 * 
 * @param {string} id - orderId or passId
 * @returns {Promise<object>} pass details & current status
 */
export const getExitPass = async (id) => {
  if (!id) return null;
  return await api.get(`/exit-passes/${id}`);
};

export default {
  verifyExitPass,
  getExitPass
};
