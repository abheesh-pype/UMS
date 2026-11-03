import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { 
  createHiringRequest, 
  getHiringRequests, 
  updateHiringRequestStatus, 
  addCandidate, 
  updateCandidateStatus, 
  getManagerHiringRequests,
  getMyDocuments
} from '../controllers/hiringController.js';

const router = Router();

// Employee API
router.get('/my-documents', protect, getMyDocuments);

// Manager API
router.post('/request', protect, authorize('ops_admin', 'ops_sub_admin', 'org_admin', 'hr_admin', 'sales_admin', 'finance_admin', 'center_admin', 'university_admin', 'academic_admin', 'ceo', 'superadmin'), createHiringRequest);
router.get('/manager-requests', protect, authorize('ops_admin', 'ops_sub_admin', 'org_admin', 'hr_admin', 'sales_admin', 'finance_admin', 'center_admin', 'university_admin', 'academic_admin', 'ceo', 'superadmin'), getManagerHiringRequests);

// HR API
router.get('/requests', protect, authorize('hr_admin', 'org_admin', 'superadmin'), getHiringRequests);
router.put('/requests/:id/status', protect, authorize('hr_admin', 'org_admin', 'superadmin'), updateHiringRequestStatus);

router.post('/candidates', protect, authorize('hr_admin', 'org_admin', 'superadmin'), addCandidate);
router.put('/candidates/:id/status', protect, authorize('hr_admin', 'org_admin', 'superadmin'), updateCandidateStatus);

export default router;
