const asyncHandler = require('../utils/asyncHandler');
const TailoringCourseModel = require('../models/TailoringCourseModel');

const sendList = (res, items) => {
  res.status(200).json({
    success: true,
    results: items.length,
    data: items,
  });
};

const createCrudHandlers = (listMethod, createMethod, updateMethod, deleteMethod) => ({
  list: asyncHandler(async (req, res) => {
    const items = await TailoringCourseModel[listMethod](req.query);
    sendList(res, items);
  }),

  create: asyncHandler(async (req, res) => {
    const item = await TailoringCourseModel[createMethod](req.body);

    res.status(201).json({
      success: true,
      data: item,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const item = await TailoringCourseModel[updateMethod](req.params.id, req.body);

    res.status(200).json({
      success: true,
      data: item,
    });
  }),

  delete: asyncHandler(async (req, res) => {
    const item = await TailoringCourseModel[deleteMethod](req.params.id);

    res.status(200).json({
      success: true,
      data: item,
    });
  }),
});

const categoryHandlers = createCrudHandlers(
  'listCourseCategories',
  'createCourseCategory',
  'updateCourseCategory',
  'deleteCourseCategory',
);
const enquiryHandlers = createCrudHandlers('listEnquiries', 'createEnquiry', 'updateEnquiry', 'deleteEnquiry');
const admissionHandlers = createCrudHandlers('listAdmissions', 'createAdmission', 'updateAdmission', 'deleteAdmission');
const studentHandlers = createCrudHandlers('listStudents', 'createStudent', 'updateStudent', 'deleteStudent');
const enrollmentHandlers = createCrudHandlers('listEnrollments', 'createEnrollment', 'updateEnrollment', 'deleteEnrollment');

const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await TailoringCourseModel.getDashboard();

  res.status(200).json({
    success: true,
    data: dashboard,
  });
});

const getConstants = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: TailoringCourseModel.constants,
  });
});

module.exports = {
  createAdmission: admissionHandlers.create,
  createCourseCategory: categoryHandlers.create,
  createEnrollment: enrollmentHandlers.create,
  createEnquiry: enquiryHandlers.create,
  createStudent: studentHandlers.create,
  deleteAdmission: admissionHandlers.delete,
  deleteCourseCategory: categoryHandlers.delete,
  deleteEnrollment: enrollmentHandlers.delete,
  deleteEnquiry: enquiryHandlers.delete,
  deleteStudent: studentHandlers.delete,
  getAdmissions: admissionHandlers.list,
  getConstants,
  getCourseCategories: categoryHandlers.list,
  getDashboard,
  getEnrollments: enrollmentHandlers.list,
  getEnquiries: enquiryHandlers.list,
  getStudents: studentHandlers.list,
  updateAdmission: admissionHandlers.update,
  updateCourseCategory: categoryHandlers.update,
  updateEnrollment: enrollmentHandlers.update,
  updateEnquiry: enquiryHandlers.update,
  updateStudent: studentHandlers.update,
};
