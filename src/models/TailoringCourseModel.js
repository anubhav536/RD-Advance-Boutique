const BaseModel = require('./BaseModel');
const AppError = require('../utils/AppError');
const jsonDatabase = require('../utils/jsonDatabase');

const STUDENT_COLLECTION = 'students';

const COURSE_CATEGORY_STATUSES = Object.freeze(['active', 'draft', 'inactive']);
const ENQUIRY_STATUSES = Object.freeze(['new', 'contacted', 'follow-up', 'converted', 'closed']);
const ADMISSION_STATUSES = Object.freeze(['pending', 'approved', 'confirmed', 'rejected', 'cancelled']);
const ENROLLMENT_STATUSES = Object.freeze(['enrolled', 'active', 'paused', 'completed', 'dropped']);
const FEE_STATUSES = Object.freeze(['pending', 'partial', 'paid', 'waived']);

const DEFAULT_CATEGORY_STATUS = 'active';
const DEFAULT_ENQUIRY_STATUS = 'new';
const DEFAULT_ADMISSION_STATUS = 'pending';
const DEFAULT_ENROLLMENT_STATUS = 'enrolled';
const DEFAULT_FEE_STATUS = 'pending';

const normalizeSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const compactString = (value) => String(value || '').trim();

const toNumber = (value, fieldName, { required = false, minimum = 0 } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new AppError(`${fieldName} is required.`, 400);
    }

    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new AppError(`${fieldName} must be a valid number.`, 400);
  }

  if (parsed < minimum) {
    throw new AppError(`${fieldName} must be greater than or equal to ${minimum}.`, 400);
  }

  return parsed;
};

const toStringArray = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const items = Array.isArray(value) ? value : String(value).split(',');

  return items
    .map((item) => compactString(item))
    .filter(Boolean);
};

const normalizeDate = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const candidate = compactString(value);
  const date = new Date(candidate);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} must be a valid date.`, 400);
  }

  return candidate;
};

const normalizeStatus = (value, allowedStatuses, defaultStatus, fieldName) => {
  const normalized = normalizeSlug(value || defaultStatus);

  if (!allowedStatuses.includes(normalized)) {
    throw new AppError(`${fieldName} must be one of: ${allowedStatuses.join(', ')}.`, 400, {
      allowedStatuses,
    });
  }

  return normalized;
};

const getStore = async () => {
  const data = await jsonDatabase.readData(STUDENT_COLLECTION);

  if (Array.isArray(data)) {
    return {
      courseCategories: [],
      enquiries: [],
      admissions: [],
      studentRecords: data,
      enrollments: [],
    };
  }

  return {
    courseCategories: Array.isArray(data.courseCategories) ? data.courseCategories : [],
    enquiries: Array.isArray(data.enquiries) ? data.enquiries : [],
    admissions: Array.isArray(data.admissions) ? data.admissions : [],
    studentRecords: Array.isArray(data.studentRecords) ? data.studentRecords : [],
    enrollments: Array.isArray(data.enrollments) ? data.enrollments : [],
    updatedAt: data.updatedAt,
  };
};

const writeStore = async (store) => jsonDatabase.writeData(STUDENT_COLLECTION, {
  courseCategories: store.courseCategories,
  enquiries: store.enquiries,
  admissions: store.admissions,
  studentRecords: store.studentRecords,
  enrollments: store.enrollments,
  updatedAt: new Date().toISOString(),
});

const createUniqueId = (preferredValue, items, prefix) => {
  const baseId = normalizeSlug(preferredValue) || `${prefix}-${Date.now()}`;
  let candidate = baseId;
  let suffix = 2;

  while (items.some((item) => String(item.id) === candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

const filterItems = (items, filters = {}, fields = []) => {
  const search = compactString(filters.search).toLowerCase();
  const status = normalizeSlug(filters.status);
  const categoryId = compactString(filters.categoryId || filters.courseCategoryId);
  const courseId = compactString(filters.courseId);
  const studentId = compactString(filters.studentId);

  return items.filter((item) => {
    if (status && normalizeSlug(item.status) !== status) {
      return false;
    }

    if (categoryId && String(item.courseCategoryId || item.categoryId) !== categoryId) {
      return false;
    }

    if (courseId && String(item.courseId) !== courseId) {
      return false;
    }

    if (studentId && String(item.studentId) !== studentId) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = fields
      .map((field) => item[field])
      .filter((value) => value !== undefined && value !== null)
      .join(' ')
      .toLowerCase();

    return haystack.includes(search);
  });
};

class TailoringCourseModel extends BaseModel {
  static get constants() {
    return {
      ADMISSION_STATUSES,
      COURSE_CATEGORY_STATUSES,
      ENQUIRY_STATUSES,
      ENROLLMENT_STATUSES,
      FEE_STATUSES,
    };
  }

  static async getDashboard() {
    const store = await getStore();

    return {
      courseCategories: store.courseCategories.length,
      enquiries: {
        total: store.enquiries.length,
        new: store.enquiries.filter((item) => item.status === 'new').length,
        contacted: store.enquiries.filter((item) => item.status === 'contacted').length,
        converted: store.enquiries.filter((item) => item.status === 'converted').length,
      },
      admissions: {
        total: store.admissions.length,
        approved: store.admissions.filter((item) => item.status === 'approved').length,
        pending: store.admissions.filter((item) => item.status === 'pending').length,
        confirmed: store.admissions.filter((item) => item.status === 'confirmed').length,
      },
      students: {
        total: store.studentRecords.length,
        active: store.studentRecords.filter((item) => item.status === 'active').length,
        completed: store.studentRecords.filter((item) => item.status === 'completed').length,
      },
      enrollments: {
        total: store.enrollments.length,
        active: store.enrollments.filter((item) => ['enrolled', 'active'].includes(item.status)).length,
        completed: store.enrollments.filter((item) => item.status === 'completed').length,
      },
      fees: {
        collected: store.enrollments.reduce((total, item) => total + Number(item.feesPaid || 0), 0),
        pending: store.enrollments.reduce((total, item) => total + Math.max(Number(item.feesTotal || 0) - Number(item.feesPaid || 0), 0), 0),
      },
    };
  }

  static async listCourseCategories(filters = {}) {
    const store = await getStore();
    return filterItems(store.courseCategories, filters, ['name', 'description', 'level']);
  }

  static async createCourseCategory(payload) {
    const store = await getStore();
    const category = TailoringCourseModel.normalizeCourseCategory(payload);
    category.id = createUniqueId(payload.id || category.name, store.courseCategories, 'course-category');
    category.createdAt = payload.createdAt || new Date().toISOString();
    category.updatedAt = new Date().toISOString();

    store.courseCategories.push(category);
    await writeStore(store);
    return category;
  }

  static async updateCourseCategory(id, payload) {
    return TailoringCourseModel.updateInCollection('courseCategories', id, payload, TailoringCourseModel.normalizeCourseCategory);
  }

  static async deleteCourseCategory(id) {
    return TailoringCourseModel.deleteFromCollection('courseCategories', id);
  }

  static async listEnquiries(filters = {}) {
    const store = await getStore();
    return filterItems(store.enquiries, filters, ['studentName', 'name', 'phone', 'email', 'courseName', 'source', 'notes']);
  }

  static async createEnquiry(payload) {
    const store = await getStore();
    const enquiry = TailoringCourseModel.normalizeEnquiry(payload);
    enquiry.id = createUniqueId(payload.id || `${enquiry.studentName}-${enquiry.phone}`, store.enquiries, 'enquiry');
    enquiry.createdAt = payload.createdAt || new Date().toISOString();
    enquiry.updatedAt = new Date().toISOString();

    store.enquiries.push(enquiry);
    await writeStore(store);
    return enquiry;
  }

  static async updateEnquiry(id, payload) {
    return TailoringCourseModel.updateInCollection('enquiries', id, payload, TailoringCourseModel.normalizeEnquiry);
  }

  static async deleteEnquiry(id) {
    return TailoringCourseModel.deleteFromCollection('enquiries', id);
  }

  static async listAdmissions(filters = {}) {
    const store = await getStore();
    return filterItems(store.admissions, filters, ['studentName', 'phone', 'email', 'courseName', 'guardianName', 'notes']);
  }

  static async createAdmission(payload) {
    const store = await getStore();
    const admission = TailoringCourseModel.normalizeAdmission(payload);
    admission.id = createUniqueId(payload.id || `${admission.studentName}-${admission.phone}`, store.admissions, 'admission');
    admission.createdAt = payload.createdAt || new Date().toISOString();
    admission.updatedAt = new Date().toISOString();

    store.admissions.push(admission);
    await writeStore(store);
    return admission;
  }

  static async updateAdmission(id, payload) {
    return TailoringCourseModel.updateInCollection('admissions', id, payload, TailoringCourseModel.normalizeAdmission);
  }

  static async deleteAdmission(id) {
    return TailoringCourseModel.deleteFromCollection('admissions', id);
  }

  static async listStudents(filters = {}) {
    const store = await getStore();
    return filterItems(store.studentRecords, filters, ['studentName', 'name', 'phone', 'email', 'courseName', 'guardianName', 'notes']);
  }

  static async createStudent(payload) {
    const store = await getStore();
    const student = TailoringCourseModel.normalizeStudent(payload);
    student.id = createUniqueId(payload.id || `${student.studentName}-${student.phone}`, store.studentRecords, 'student');
    student.createdAt = payload.createdAt || new Date().toISOString();
    student.updatedAt = new Date().toISOString();

    store.studentRecords.push(student);
    await writeStore(store);
    return student;
  }

  static async updateStudent(id, payload) {
    return TailoringCourseModel.updateInCollection('studentRecords', id, payload, TailoringCourseModel.normalizeStudent);
  }

  static async deleteStudent(id) {
    return TailoringCourseModel.deleteFromCollection('studentRecords', id);
  }

  static async listEnrollments(filters = {}) {
    const store = await getStore();
    return filterItems(store.enrollments, filters, ['studentName', 'courseName', 'batchName', 'notes']);
  }

  static async createEnrollment(payload) {
    const store = await getStore();
    const enrollment = TailoringCourseModel.normalizeEnrollment(payload);
    enrollment.id = createUniqueId(payload.id || `${enrollment.studentId}-${enrollment.courseId || enrollment.courseName}`, store.enrollments, 'enrollment');
    enrollment.createdAt = payload.createdAt || new Date().toISOString();
    enrollment.updatedAt = new Date().toISOString();

    store.enrollments.push(enrollment);
    await writeStore(store);
    return enrollment;
  }

  static async updateEnrollment(id, payload) {
    return TailoringCourseModel.updateInCollection('enrollments', id, payload, TailoringCourseModel.normalizeEnrollment);
  }

  static async deleteEnrollment(id) {
    return TailoringCourseModel.deleteFromCollection('enrollments', id);
  }

  static async updateInCollection(collectionName, id, payload, normalizer) {
    const store = await getStore();
    const index = store[collectionName].findIndex((item) => String(item.id) === String(id));

    if (index === -1) {
      throw new AppError(`No ${collectionName} item with id "${id}" exists.`, 404);
    }

    const updates = normalizer(payload, { partial: true, currentItem: store[collectionName][index] });
    const updatedItem = {
      ...store[collectionName][index],
      ...updates,
      id: store[collectionName][index].id,
      createdAt: store[collectionName][index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    store[collectionName][index] = updatedItem;
    await writeStore(store);
    return updatedItem;
  }

  static async deleteFromCollection(collectionName, id) {
    const store = await getStore();
    const item = store[collectionName].find((entry) => String(entry.id) === String(id));

    if (!item) {
      throw new AppError(`No ${collectionName} item with id "${id}" exists.`, 404);
    }

    store[collectionName] = store[collectionName].filter((entry) => String(entry.id) !== String(id));
    await writeStore(store);
    return item;
  }

  static normalizeCourseCategory(payload, { partial = false } = {}) {
    const normalized = {};

    if (!partial || payload.name !== undefined) {
      const name = compactString(payload.name);

      if (!name) {
        throw new AppError('Course category name is required.', 400);
      }

      normalized.name = name;
    }

    if (payload.description !== undefined || !partial) {
      normalized.description = compactString(payload.description);
    }

    if (payload.level !== undefined || !partial) {
      normalized.level = compactString(payload.level || 'Beginner');
    }

    if (payload.duration !== undefined || !partial) {
      normalized.duration = compactString(payload.duration);
    }

    if (payload.fees !== undefined || !partial) {
      normalized.fees = toNumber(payload.fees, 'fees') ?? 0;
    }

    if (payload.skills !== undefined || !partial) {
      normalized.skills = toStringArray(payload.skills);
    }

    if (payload.status !== undefined || !partial) {
      normalized.status = normalizeStatus(payload.status, COURSE_CATEGORY_STATUSES, DEFAULT_CATEGORY_STATUS, 'Course category status');
    }

    return normalized;
  }

  static normalizeEnquiry(payload, { partial = false } = {}) {
    const normalized = {};

    TailoringCourseModel.normalizePersonFields(normalized, payload, partial);

    if (payload.courseCategoryId !== undefined || payload.categoryId !== undefined || !partial) {
      normalized.courseCategoryId = compactString(payload.courseCategoryId || payload.categoryId);
    }

    if (payload.courseName !== undefined || !partial) {
      normalized.courseName = compactString(payload.courseName);
    }

    if (payload.source !== undefined || !partial) {
      normalized.source = compactString(payload.source || 'Website');
    }

    if (payload.preferredBatch !== undefined || !partial) {
      normalized.preferredBatch = compactString(payload.preferredBatch);
    }

    if (payload.followUpDate !== undefined) {
      normalized.followUpDate = normalizeDate(payload.followUpDate, 'followUpDate');
    }

    if (payload.notes !== undefined || !partial) {
      normalized.notes = compactString(payload.notes);
    }

    if (payload.status !== undefined || !partial) {
      normalized.status = normalizeStatus(payload.status, ENQUIRY_STATUSES, DEFAULT_ENQUIRY_STATUS, 'Enquiry status');
    }

    return normalized;
  }

  static normalizeAdmission(payload, { partial = false } = {}) {
    const normalized = {};

    TailoringCourseModel.normalizePersonFields(normalized, payload, partial);
    TailoringCourseModel.normalizeCourseFields(normalized, payload, partial);

    if (payload.enquiryId !== undefined) {
      normalized.enquiryId = compactString(payload.enquiryId);
    }

    if (payload.guardianName !== undefined || !partial) {
      normalized.guardianName = compactString(payload.guardianName);
    }

    if (payload.admissionDate !== undefined || !partial) {
      normalized.admissionDate = normalizeDate(payload.admissionDate, 'admissionDate') || new Date().toISOString().slice(0, 10);
    }

    if (payload.feesTotal !== undefined || !partial) {
      normalized.feesTotal = toNumber(payload.feesTotal, 'feesTotal') ?? 0;
    }

    if (payload.feesPaid !== undefined || !partial) {
      normalized.feesPaid = toNumber(payload.feesPaid, 'feesPaid') ?? 0;
    }

    if (payload.feeStatus !== undefined || !partial) {
      normalized.feeStatus = normalizeStatus(payload.feeStatus, FEE_STATUSES, DEFAULT_FEE_STATUS, 'Fee status');
    }

    if (payload.documents !== undefined || !partial) {
      normalized.documents = toStringArray(payload.documents);
    }

    if (payload.notes !== undefined || !partial) {
      normalized.notes = compactString(payload.notes);
    }

    if (payload.status !== undefined || !partial) {
      normalized.status = normalizeStatus(payload.status, ADMISSION_STATUSES, DEFAULT_ADMISSION_STATUS, 'Admission status');
    }

    return normalized;
  }

  static normalizeStudent(payload, { partial = false } = {}) {
    const normalized = {};

    TailoringCourseModel.normalizePersonFields(normalized, payload, partial);
    TailoringCourseModel.normalizeCourseFields(normalized, payload, partial);

    if (payload.admissionId !== undefined) {
      normalized.admissionId = compactString(payload.admissionId);
    }

    if (payload.guardianName !== undefined || !partial) {
      normalized.guardianName = compactString(payload.guardianName);
    }

    if (payload.joinDate !== undefined || !partial) {
      normalized.joinDate = normalizeDate(payload.joinDate, 'joinDate') || new Date().toISOString().slice(0, 10);
    }

    if (payload.progress !== undefined || !partial) {
      normalized.progress = toNumber(payload.progress, 'progress') ?? 0;
    }

    if (payload.completedProjects !== undefined || !partial) {
      normalized.completedProjects = toNumber(payload.completedProjects, 'completedProjects') ?? 0;
    }

    if (payload.notes !== undefined || !partial) {
      normalized.notes = compactString(payload.notes);
    }

    if (payload.status !== undefined || !partial) {
      normalized.status = normalizeStatus(payload.status, ENROLLMENT_STATUSES, 'active', 'Student status');
    }

    return normalized;
  }

  static normalizeEnrollment(payload, { partial = false } = {}) {
    const normalized = {};

    if (!partial || payload.studentId !== undefined) {
      const studentId = compactString(payload.studentId);

      if (!studentId) {
        throw new AppError('studentId is required.', 400);
      }

      normalized.studentId = studentId;
    }

    if (payload.studentName !== undefined || !partial) {
      normalized.studentName = compactString(payload.studentName || payload.name);
    }

    TailoringCourseModel.normalizeCourseFields(normalized, payload, partial);

    if (payload.batchName !== undefined || !partial) {
      normalized.batchName = compactString(payload.batchName);
    }

    if (payload.startDate !== undefined || !partial) {
      normalized.startDate = normalizeDate(payload.startDate, 'startDate') || new Date().toISOString().slice(0, 10);
    }

    if (payload.expectedEndDate !== undefined) {
      normalized.expectedEndDate = normalizeDate(payload.expectedEndDate, 'expectedEndDate');
    }

    if (payload.completedAt !== undefined) {
      normalized.completedAt = normalizeDate(payload.completedAt, 'completedAt');
    }

    if (payload.progress !== undefined || !partial) {
      normalized.progress = toNumber(payload.progress, 'progress') ?? 0;
    }

    if (payload.feesTotal !== undefined || !partial) {
      normalized.feesTotal = toNumber(payload.feesTotal, 'feesTotal') ?? 0;
    }

    if (payload.feesPaid !== undefined || !partial) {
      normalized.feesPaid = toNumber(payload.feesPaid, 'feesPaid') ?? 0;
    }

    if (payload.feeStatus !== undefined || !partial) {
      normalized.feeStatus = normalizeStatus(payload.feeStatus, FEE_STATUSES, DEFAULT_FEE_STATUS, 'Fee status');
    }

    if (payload.notes !== undefined || !partial) {
      normalized.notes = compactString(payload.notes);
    }

    if (payload.status !== undefined || !partial) {
      normalized.status = normalizeStatus(payload.status, ENROLLMENT_STATUSES, DEFAULT_ENROLLMENT_STATUS, 'Enrollment status');
    }

    return normalized;
  }

  static normalizePersonFields(normalized, payload, partial) {
    if (!partial || payload.studentName !== undefined || payload.name !== undefined) {
      const studentName = compactString(payload.studentName || payload.name);

      if (!studentName) {
        throw new AppError('Student name is required.', 400);
      }

      normalized.studentName = studentName;
      normalized.name = studentName;
    }

    if (!partial || payload.phone !== undefined) {
      const phone = compactString(payload.phone);

      if (!phone) {
        throw new AppError('Student phone is required.', 400);
      }

      normalized.phone = phone;
    }

    if (payload.email !== undefined || !partial) {
      normalized.email = compactString(payload.email).toLowerCase();
    }

    if (payload.address !== undefined || !partial) {
      normalized.address = compactString(payload.address);
    }
  }

  static normalizeCourseFields(normalized, payload, partial) {
    if (payload.courseCategoryId !== undefined || payload.categoryId !== undefined || !partial) {
      normalized.courseCategoryId = compactString(payload.courseCategoryId || payload.categoryId);
    }

    if (payload.courseId !== undefined || !partial) {
      normalized.courseId = compactString(payload.courseId || payload.courseCategoryId || payload.categoryId);
    }

    if (payload.courseName !== undefined || !partial) {
      normalized.courseName = compactString(payload.courseName);
    }
  }
}

module.exports = TailoringCourseModel;
