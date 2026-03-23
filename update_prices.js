const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/database.sqlite');

const prices = {
  "XND": 0.164, "X6O": 0.250, "LND": 0.261, "LG": 0.391, "C6O": 0.469,
  "B1L": 0.519, "X5L": 0.555, "B1O": 0.571, "XLV": 0.579, "LK": 0.589,
  "X5O": 0.590, "C5L": 0.604, "XOV": 0.634, "C5O": 0.654, "X4L": 0.891,
  "X4O": 0.939, "LLV": 0.950, "M5R": 0.969, "M5L": 1.058, "L5R": 1.072,
  "LOV": 1.094, "M5O": 1.229, "L5L": 1.240, "C4L": 1.262, "C4O": 1.368,
  "L5O": 1.378, "M4L": 1.385, "M4R": 1.396, "L4R": 1.441, "X3L": 1.474,
  "X3O": 1.588, "M4O": 1.731, "L4L": 1.748, "C3L": 1.795, "C3O": 1.870,
  "M3R": 1.895, "L4O": 1.900, "M3L": 1.973, "L3R": 2.012, "X2L": 2.112,
  "X2O": 2.225, "L3L": 2.246, "M3O": 2.324, "X1L": 2.370, "C2L": 2.383,
  "X1O": 2.405, "C2O": 2.556, "M2L": 2.600, "C1L": 2.632, "L3O": 2.688,
  "M2R": 2.720, "C1O": 2.753, "L2R": 2.763, "M1R": 2.841, "L2L": 2.843,
  "L3OF": 2.860, "M2O": 2.917, "M1L": 3.010, "L2O": 3.130, "M1O": 3.163,
  "L1R": 3.176, "L1L": 3.185, "L2OF": 3.240, "L1O": 3.268, "L1OF": 3.320
};

db.serialize(() => {
  const stmt = db.prepare("UPDATE grades SET price = ? WHERE grade_code = ?");
  for (const [code, price] of Object.entries(prices)) {
    stmt.run(price, code, (err) => {
      if (err) console.error(`Failed to update ${code}:`, err);
    });
  }
  stmt.finalize(() => {
    console.log('Finished updating grade prices.');
    db.close();
  });
});
