const express = require('express');
const tailoringCourseController = require('../controllers/tailoringCourseController');

const router = express.Router();

const crudRoute = (path, listHandler, createHandler, updateHandler, deleteHandler) => {
  router
    .route(path)
    .get(listHandler)
    .post(createHandler);

  router
    .route(`${path}/:id`)
    .put(updateHandler)
    .patch(updateHandler)
    .delete(deleteHandler);
};

router.get('/dashboard', tailoringCourseController.getDashboard);
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
