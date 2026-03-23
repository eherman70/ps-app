export const TOBACCO_CATEGORIES = ['LUGS', 'CUTTERS', 'THIN_LEAF', 'LEAF', 'SMOKING_LEAF', 'OTHER'];
export const QUALITY_LEVELS = ['Choice', 'Fine', 'Good', 'Fair', 'Low', 'Reject'];

export const TOBACCO_GRADES_MASTER = [
  // LUGS (X)
  { code: 'X1L', group: 'LUGS_LEMON', category: 'LUGS', quality: 'Choice', price: 2.370, grade_class: 'STANDARD' },
  { code: 'X2L', group: 'LUGS_LEMON', category: 'LUGS', quality: 'Fine', price: 2.112, grade_class: 'STANDARD' },
  { code: 'X3L', group: 'LUGS_LEMON', category: 'LUGS', quality: 'Good', price: 1.474, grade_class: 'STANDARD' },
  { code: 'X4L', group: 'LUGS_LEMON', category: 'LUGS', quality: 'Fair', price: 0.891, grade_class: 'STANDARD' },
  { code: 'X5L', group: 'LUGS_LEMON', category: 'LUGS', quality: 'Low', price: 0.555, grade_class: 'STANDARD' },
  { code: 'X1O', group: 'LUGS_ORANGE', category: 'LUGS', quality: 'Choice', price: 2.405, grade_class: 'STANDARD' },
  { code: 'X2O', group: 'LUGS_ORANGE', category: 'LUGS', quality: 'Fine', price: 2.225, grade_class: 'STANDARD' },
  { code: 'X3O', group: 'LUGS_ORANGE', category: 'LUGS', quality: 'Good', price: 1.588, grade_class: 'STANDARD' },
  { code: 'X4O', group: 'LUGS_ORANGE', category: 'LUGS', quality: 'Fair', price: 0.939, grade_class: 'STANDARD' },
  { code: 'X5O', group: 'LUGS_ORANGE', category: 'LUGS', quality: 'Low', price: 0.590, grade_class: 'STANDARD' },
  { code: 'X6O', group: 'LUGS_ORANGE', category: 'LUGS', quality: 'Reject', price: 0.250, grade_class: 'REJECT' },
  { code: 'XLV', group: 'LUGS_VAR', category: 'LUGS', quality: 'Low', price: 0.579, grade_class: 'STANDARD' },
  { code: 'XOV', group: 'LUGS_VAR', category: 'LUGS', quality: 'Low', price: 0.634, grade_class: 'STANDARD' },
  { code: 'XND', group: 'NON_DESCRIPT', category: 'LUGS', quality: 'Reject', price: 0.164, grade_class: 'REJECT' },
  { code: 'XG', group: 'LUGS_REJECT', category: 'LUGS', quality: 'Reject', price: 0.391, grade_class: 'REJECT' },

  // CUTTERS (C)
  { code: 'C1L', group: 'CUTTERS_LEMON', category: 'CUTTERS', quality: 'Choice', price: 2.632, grade_class: 'STANDARD' },
  { code: 'C2L', group: 'CUTTERS_LEMON', category: 'CUTTERS', quality: 'Fine', price: 2.383, grade_class: 'STANDARD' },
  { code: 'C3L', group: 'CUTTERS_LEMON', category: 'CUTTERS', quality: 'Good', price: 1.795, grade_class: 'STANDARD' },
  { code: 'C4L', group: 'CUTTERS_LEMON', category: 'CUTTERS', quality: 'Fair', price: 1.262, grade_class: 'STANDARD' },
  { code: 'C5L', group: 'CUTTERS_LEMON', category: 'CUTTERS', quality: 'Low', price: 0.604, grade_class: 'STANDARD' },
  { code: 'C1O', group: 'CUTTERS_ORANGE', category: 'CUTTERS', quality: 'Choice', price: 2.753, grade_class: 'STANDARD' },
  { code: 'C2O', group: 'CUTTERS_ORANGE', category: 'CUTTERS', quality: 'Fine', price: 2.556, grade_class: 'STANDARD' },
  { code: 'C3O', group: 'CUTTERS_ORANGE', category: 'CUTTERS', quality: 'Good', price: 1.870, grade_class: 'STANDARD' },
  { code: 'C4O', group: 'CUTTERS_ORANGE', category: 'CUTTERS', quality: 'Fair', price: 1.368, grade_class: 'STANDARD' },
  { code: 'C5O', group: 'CUTTERS_ORANGE', category: 'CUTTERS', quality: 'Low', price: 0.654, grade_class: 'STANDARD' },
  { code: 'C6O', group: 'CUTTERS_ORANGE', category: 'CUTTERS', quality: 'Reject', price: 0.469, grade_class: 'REJECT' },

  // LEAF (L / B)
  { code: 'L1L', group: 'LEAF_LEMON', category: 'LEAF', quality: 'Choice', price: 3.185, grade_class: 'STANDARD' },
  { code: 'L2L', group: 'LEAF_LEMON', category: 'LEAF', quality: 'Fine', price: 2.843, grade_class: 'STANDARD' },
  { code: 'L3L', group: 'LEAF_LEMON', category: 'LEAF', quality: 'Good', price: 2.246, grade_class: 'STANDARD' },
  { code: 'L4L', group: 'LEAF_LEMON', category: 'LEAF', quality: 'Fair', price: 1.748, grade_class: 'STANDARD' },
  { code: 'L5L', group: 'LEAF_LEMON', category: 'LEAF', quality: 'Low', price: 1.240, grade_class: 'STANDARD' },
  { code: 'L1O', group: 'LEAF_ORANGE', category: 'LEAF', quality: 'Choice', price: 3.268, grade_class: 'STANDARD' },
  { code: 'L2O', group: 'LEAF_ORANGE', category: 'LEAF', quality: 'Fine', price: 3.130, grade_class: 'STANDARD' },
  { code: 'L3O', group: 'LEAF_ORANGE', category: 'LEAF', quality: 'Good', price: 2.688, grade_class: 'STANDARD' },
  { code: 'L4O', group: 'LEAF_ORANGE', category: 'LEAF', quality: 'Fair', price: 1.900, grade_class: 'STANDARD' },
  { code: 'L5O', group: 'LEAF_ORANGE', category: 'LEAF', quality: 'Low', price: 1.378, grade_class: 'STANDARD' },
  { code: 'L1R', group: 'LEAF_RED', category: 'LEAF', quality: 'Choice', price: 3.176, grade_class: 'STANDARD' },
  { code: 'L2R', group: 'LEAF_RED', category: 'LEAF', quality: 'Fine', price: 2.763, grade_class: 'STANDARD' },
  { code: 'L3R', group: 'LEAF_RED', category: 'LEAF', quality: 'Good', price: 2.012, grade_class: 'STANDARD' },
  { code: 'L4R', group: 'LEAF_RED', category: 'LEAF', quality: 'Fair', price: 1.441, grade_class: 'STANDARD' },
  { code: 'L5R', group: 'LEAF_RED', category: 'LEAF', quality: 'Low', price: 1.072, grade_class: 'STANDARD' },
  { code: 'LLV', group: 'LEAF_VAR', category: 'LEAF', quality: 'Low', price: 0.950, grade_class: 'STANDARD' },
  { code: 'LOV', group: 'LEAF_VAR', category: 'LEAF', quality: 'Low', price: 1.094, grade_class: 'STANDARD' },
  { code: 'LND', group: 'NON_DESCRIPT', category: 'LEAF', quality: 'Reject', price: 0.261, grade_class: 'REJECT' },
  { code: 'LG', group: 'LEAF_REJECT', category: 'LEAF', quality: 'Reject', price: 0.391, grade_class: 'REJECT' },
  { code: 'B1L', group: 'BRIGHT_LEAF', category: 'LEAF', quality: 'Choice', price: 0.519, grade_class: 'SPECIAL', is_quality_grade: 1 },
  { code: 'B1O', group: 'BRIGHT_LEAF', category: 'LEAF', quality: 'Choice', price: 0.571, grade_class: 'SPECIAL', is_quality_grade: 1 },
  { code: 'LK', group: 'LEAF_VAR', category: 'LEAF', quality: 'Low', price: 0.589, grade_class: 'SPECIAL', is_quality_grade: 1 },

  // SMOKING LEAF (M)
  { code: 'M1L', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Choice', price: 3.010, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M2L', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Fine', price: 2.600, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M3L', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Good', price: 1.973, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M4L', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Fair', price: 1.385, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M5L', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Low', price: 1.058, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M1O', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Choice', price: 3.163, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M2O', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Fine', price: 2.917, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M3O', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Good', price: 2.324, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M4O', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Fair', price: 1.731, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M5O', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Low', price: 1.229, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M1R', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Choice', price: 2.841, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M2R', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Fine', price: 2.720, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M3R', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Good', price: 1.895, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M4R', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Fair', price: 1.396, grade_class: 'STANDARD', is_quality_grade: 1 },
  { code: 'M5R', group: 'SMOKING_LEAF', category: 'SMOKING_LEAF', quality: 'Low', price: 0.969, grade_class: 'STANDARD', is_quality_grade: 1 },

  // PREMIUM FULL ORANGE LEAF
  { code: 'L1OF', group: 'LEAF_ORANGE_FULL', category: 'LEAF', quality: 'Choice', price: 3.320, grade_class: 'PREMIUM', is_quality_grade: 1 },
  { code: 'L2OF', group: 'LEAF_ORANGE_FULL', category: 'LEAF', quality: 'Fine', price: 3.240, grade_class: 'PREMIUM', is_quality_grade: 1 },
  { code: 'L3OF', group: 'LEAF_ORANGE_FULL', category: 'LEAF', quality: 'Good', price: 2.860, grade_class: 'PREMIUM', is_quality_grade: 1 },

  // REJECT & OPERATIONAL GRADES (NEW)
  { code: 'REJ', group: 'REJECT', category: 'REJECT', quality: 'Reject', price: 0, grade_class: 'REJECT', is_quality_grade: 1 },
  { code: 'CAN', group: 'PROCESS', category: 'PROCESS', quality: 'None', price: 0, grade_class: 'PROCESS', is_quality_grade: 0 },
  { code: 'WIT', group: 'PROCESS', category: 'PROCESS', quality: 'None', price: 0, grade_class: 'PROCESS', is_quality_grade: 0 }
];
