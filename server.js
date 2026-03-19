const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/students',    require('./routes/students'));
app.use('/api/attendance',  require('./routes/attendance'));
app.use('/api/fees',        require('./routes/fees'));
app.use('/api/subjects',    require('./routes/subjects'));
app.use('/api/marks',       require('./routes/marks'));
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/levels',      require('./routes/levels'));
app.use('/api/programmes',  require('./routes/programmes'));
app.use('/api/faculties',   require('./routes/faculties'));
app.use('/api/enrollment',  require('./routes/enrollment'));
app.use('/api/disciplines', require('./routes/disciplines'));

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});
