// @ts-nocheck
import express from 'express';
import {
  getUniversities,
  getUniversity,
  createUniversity,
  updateUniversity,
  deleteUniversity,
  activateUniversity,
  getPrograms,
  getProgram,
  createProgram,
  importProgramsFromSession,
  updateProgram,
  deleteProgram,
  activateProgram,
  getProgramModules,
  createProgramModule,
  getProgramSemesters,
  createProgramSemester,
  updateProgramSemester,
  deleteProgramSemester,
  updateProgramModule,
  deleteProgramModule,
  getExaminations,
  getExaminationRegistrations,
  getAllExaminationRegistrations,
  removeExaminationRegistration,
  createExamination,
  updateExamination,
  deleteExamination,
  updateExaminationModules,
  getStudyCenters,
  getStudyCenter,
  createStudyCenter,
  updateStudyCenter,
  deleteStudyCenter,
  approveStudyCenter,
  suspendStudyCenter,
  getAdmissionSessions,
  getAdmissionSession,
  createAdmissionSession,
  updateAdmissionSession,
  deleteAdmissionSession,
  approveAdmissionSession,
  duplicateSession,
  getInternalMarks,
  createInternalMark,
  updateInternalMark,
  deleteInternalMark,
  getAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getPendingVerificationCenters,
  verifyCenter,
  getProgramAllocations,
  allocateProgram,
  updateProgramAllocationStatus,
  removeAllocation,
  getUniversityAllocations,
  allocateUniversity,
  removeUniversityAllocation,
  bulkImportStudyCenters,
  updateBranchSettings,
} from '../controllers/operationsController.js';
import { resubmitStudyCenter } from '../controllers/salesController.js';
import {
  getUniversityStudents,
  getUniversityMetrics,
  updateEnrollmentUniNumber,
} from '../controllers/universityStudentsController.js';
import {
  getProgramDetail,
  getProgramMaterials,
  getAllProgramEbooks,
  getAllVideoClasses,
  createVideoClass,
  updateVideoClass,
  deleteVideoClass,
  uploadProgramMaterial,
  uploadProgramVideo,
  updateProgramMaterial,
  deleteProgramMaterial,
} from '../controllers/programMaterialController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload, uploadPaymentProof, uploadVideo } from '../middleware/upload.js';
import { createScheduledClass, getSchedulableStudents, getScheduledClasses } from '../controllers/scheduledClassController.js';
import { getExamPortalIntegration, saveExamPortalIntegration } from '../controllers/examIntegrationController.js';

const router = express.Router();

router.use(protect);

router.get('/universities/:universityId/exam-portal-integration', authorize('university_admin', 'org_admin', 'superadmin'), getExamPortalIntegration);
router.put('/universities/:universityId/exam-portal-integration', authorize('university_admin', 'org_admin', 'superadmin'), saveExamPortalIntegration);
router.get('/universities/:universityId/students', authorize('university_admin', 'org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin'), getUniversityStudents);
router.get('/universities/:universityId/metrics', authorize('university_admin', 'org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin'), getUniversityMetrics);

// Universities — write access restricted to org_admin / superadmin & operations admin
router.route('/universities').get(getUniversities).post(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin'), createUniversity);
router.route('/universities/:id')
  .get(getUniversity)
  .put(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin'), updateUniversity)
  .delete(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin'), deleteUniversity);
router.put('/universities/:id/activate', authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin'), activateUniversity);

// Programs — write access restricted to org_admin / superadmin & operations admin
router.route('/programs').get(getPrograms).post(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), createProgram);
router.post('/programs/import-from-session', authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), importProgramsFromSession);
router.route('/programs/:id')
  .get(getProgram)
  .put(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), updateProgram)
  .delete(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), deleteProgram);
router.put('/programs/:id/activate', authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin'), activateProgram);
router.route('/programs/:programId/semesters')
  .get(getProgramSemesters)
  .post(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), createProgramSemester);
router.route('/programs/:programId/semesters/:semesterId')
  .put(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), updateProgramSemester)
  .delete(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), deleteProgramSemester);
router.route('/programs/:programId/modules')
  .get(getProgramModules)
  .post(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), createProgramModule);
router.route('/programs/:programId/modules/:moduleId')
  .put(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), updateProgramModule)
  .delete(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), deleteProgramModule);
router.route('/examinations')
  .get(getExaminations)
  .post(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), createExamination);
router.get('/examinations/registrations', authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), getAllExaminationRegistrations);
router.delete('/examinations/registrations/:registrationId', authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), removeExaminationRegistration);
router.route('/examinations/:id')
  .put(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), updateExamination)
  .delete(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), deleteExamination);
router.get('/examinations/:id/registrations', authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), getExaminationRegistrations);
router.put('/examinations/:id/modules', authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), updateExaminationModules);

// Onboarding — document verification (must be before /centers/:id to avoid route conflict)
router.get('/centers/pending-verification', authorize('ops_admin', 'ops_sub_admin', 'employee'), getPendingVerificationCenters);
router.put('/centers/:id/verify', authorize('ops_admin', 'ops_sub_admin', 'employee'), uploadPaymentProof.single('paymentProof'), verifyCenter);

// Study Centers Bulk Import
router.post('/centers/bulk-import', authorize('org_admin', 'superadmin', 'ops_admin'), bulkImportStudyCenters);

// Branch-level settings (must be before /centers/:id)
router.put('/centers/branch-settings', authorize('org_admin', 'superadmin'), updateBranchSettings);

// Study Centers
router.route('/centers')
  .get(getStudyCenters)
  .post(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'sales_admin', 'bde', 'employee'), createStudyCenter);
router.route('/centers/:id')
  .get(getStudyCenter)
  .put(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin'), updateStudyCenter)
  .delete(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin'), deleteStudyCenter);
router.put('/centers/:id/resubmit', authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'sales_admin', 'bde', 'employee'), resubmitStudyCenter);
router.put('/centers/:id/approve', authorize('ops_admin', 'finance_admin'), approveStudyCenter);
router.put('/centers/:id/suspend', authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin'), suspendStudyCenter);

// Admission Sessions
router.route('/sessions').get(getAdmissionSessions).post(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), createAdmissionSession);
router.route('/sessions/:id')
  .get(getAdmissionSession)
  .put(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), updateAdmissionSession)
  .delete(authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'academic_admin'), deleteAdmissionSession);
router.put('/sessions/:id/approve', authorize('finance_admin'), approveAdmissionSession);
router.post('/sessions/:id/duplicate', authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin'), duplicateSession);

// Internal Marks — study centers enter marks, ops has read-only
router.route('/marks').get(getInternalMarks).post(authorize('center_admin', 'ops_admin', 'org_admin', 'superadmin'), createInternalMark);
router.route('/marks/:id').put(authorize('center_admin', 'ops_admin', 'org_admin', 'superadmin'), updateInternalMark).delete(authorize('center_admin', 'ops_admin', 'org_admin', 'superadmin'), deleteInternalMark);

// Announcements
router.route('/announcements').get(getAnnouncements).post(authorize('ops_admin', 'hr_admin'), createAnnouncement);
router.route('/announcements/:id')
  .get(getAnnouncement)
  .put(authorize('ops_admin', 'hr_admin'), updateAnnouncement)
  .delete(authorize('ops_admin', 'hr_admin'), deleteAnnouncement);

// Onboarding — program allocation
router.route('/centers/:id/allocations')
  .get(authorize('ops_admin', 'ops_sub_admin', 'employee'), getProgramAllocations)
  .post(authorize('ops_admin', 'ops_sub_admin', 'employee'), allocateProgram);
router.put('/centers/:id/allocations/:allocId', authorize('ops_admin', 'ops_sub_admin', 'employee'), updateProgramAllocationStatus);
router.delete('/centers/:id/allocations/:allocId', authorize('ops_admin', 'ops_sub_admin', 'employee'), removeAllocation);

// Onboarding — university allocation
router.route('/centers/:id/uni-allocations')
  .get(authorize('ops_admin', 'ops_sub_admin', 'employee'), getUniversityAllocations)
  .post(authorize('ops_admin', 'ops_sub_admin', 'employee'), allocateUniversity);
router.delete('/centers/:id/uni-allocations/:allocId', authorize('ops_admin', 'ops_sub_admin', 'employee'), removeUniversityAllocation);

// Program detail & materials
router.get('/ebooks', authorize('academic_admin'), getAllProgramEbooks);
router.get('/video-classes', authorize('academic_admin', 'ops_admin', 'superadmin', 'org_admin'), getAllVideoClasses);
router.post('/video-classes', authorize('academic_admin', 'ops_admin', 'superadmin', 'org_admin'), upload.single('file'), createVideoClass);
router.put('/video-classes/:id', authorize('academic_admin', 'ops_admin', 'superadmin', 'org_admin'), upload.single('file'), updateVideoClass);
router.delete('/video-classes/:id', authorize('academic_admin', 'ops_admin', 'superadmin', 'org_admin'), deleteVideoClass);
router.route('/scheduled-classes')
  .get(authorize('academic_admin'), getScheduledClasses)
  .post(authorize('academic_admin'), createScheduledClass);
router.get('/scheduled-classes/students', authorize('academic_admin'), getSchedulableStudents);
router.get('/programs/:programId/detail', getProgramDetail);
router.get('/programs/:programId/materials', getProgramMaterials);
router.post('/programs/:programId/materials', authorize('ops_admin', 'ops_sub_admin', 'employee', 'org_admin', 'superadmin', 'academic_admin'), upload.single('file'), uploadProgramMaterial);
router.post('/programs/:programId/videos', authorize('academic_admin'), uploadVideo.single('file'), uploadProgramVideo);
router.put('/programs/:programId/materials/:materialId', authorize('ops_admin', 'ops_sub_admin', 'employee', 'org_admin', 'superadmin', 'academic_admin'), upload.single('file'), updateProgramMaterial);
router.delete('/programs/:programId/materials/:materialId', authorize('ops_admin', 'ops_sub_admin', 'employee', 'org_admin', 'superadmin', 'academic_admin'), deleteProgramMaterial);

// Enrollment Uni Enrollment Number Updates
router.put('/enrollments/:id', authorize('ops_admin', 'ops_sub_admin', 'employee', 'org_admin', 'superadmin', 'university_admin'), updateEnrollmentUniNumber);

export default router;
