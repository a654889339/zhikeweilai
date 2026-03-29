const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { syncDatabase } = require('./models');
const { cosUrlSigningMiddleware } = require('./middleware/cosUrlSigning');

const app = express();

app.use(cors());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

const orderController = require('./controllers/orderController');
app.post(
  '/api/orders/wechat/notify',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    try {
      const text = req.body.toString('utf8');
      req.body = JSON.parse(text);
    } catch (e) {
      return res.status(400).json({ code: 'FAIL', message: 'invalid body' });
    }
    return orderController.wechatPayNotify(req, res);
  },
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const fs = require('fs');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.use('/uploads', express.static(uploadsDir));

app.use('/api', cosUrlSigningMiddleware, routes);

app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' });
});

app.use((err, req, res, _next) => {
  console.error('[Error]', err.stack);
  const message = config.nodeEnv === 'development' ? err.message : '服务器内部错误';
  res.status(500).json({ code: 500, message });
});

const start = async () => {
  const dbOk = await syncDatabase();
  if (!dbOk) {
    console.error('[Vino] Database connection failed. Exiting.');
    process.exit(1);
  }
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Vino Backend] running on http://0.0.0.0:${config.port}`);
  });
};

start();
