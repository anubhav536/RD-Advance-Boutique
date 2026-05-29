const express = require('express');
const tailoringCourseController = require('../controllers/tailoringCourseController');
const { requireAdminApi } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

const crudRoute = (path, listHandler, createHandler, updateHandler, deleteHandler) => {
  router
    .route(path)
    .get(listHandler)
    .post(requireAdminApi, createHandler);

  router
    .route(`${path}/:id`)
    .put(requireAdminApi, updateHandler)
    .patch(requireAdminApi, updateHandler)
    .delete(requireAdminApi, deleteHandler);
};

router.get('/dashboard', requireAdminApi, tailoringCourseController.getDashboard);
router.get('/constants', tailoringCourseController.getConstants);

crudRoute(
  '/categories',
  tailoringCourseController.getCourseCategories,
  tailoringCourseController.createCourseCategory,
  tailoringCourseController.updateCourseCategory,
  tailoringCourseController.deleteCourseCategory,
);

crudRoute(
  '/enquiries',
  tailoringCourseController.getEnquiries,
  tailoringCourseController.createEnquiry,
  tailoringCourseController.updateEnquiry,
  tailoringCourseController.deleteEnquiry,
);

crudRoute(
  '/admissions',
  tailoringCourseController.getAdmissions,
  tailoringCourseController.createAdmission,
  tailoringCourseController.updateAdmission,
  tailoringCourseController.deleteAdmission,
);

crudRoute(
  '/students',
  tailoringCourseController.getStudents,
  tailoringCourseController.createStudent,
  tailoringCourseController.updateStudent,
  tailoringCourseController.deleteStudent,
);

crudRoute(
  '/enrollments',
  tailoringCourseController.getEnrollments,
  tailoringCourseController.createEnrollment,
  tailoringCourseController.updateEnrollment,
  tailoringCourseController.deleteEnrollment,
);

module.exports = router;
