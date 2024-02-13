const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const Product = require('./models/products');
const bcrypt = require('bcrypt');
const User = require('./models/users.js');
const session = require('express-session');
const path = require('path');
const ejsMate = require('ejs-mate')
const env = require('dotenv');
const app = express();
const PORT = process.env.PORT || 3000;
env.config();
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname + 'views'));

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// Connect to MongoDB
const uri = process.env.db_URL;
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// session management
const secret = process.env.SECRET || 'thisshouldbebettersecret';
app.use(session({
  secret,
  resave: false,
  saveUninitialized: true
}));

// authentication middleware
async function authenticate(req, res, next) {
  const { username, password } = req.session;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid username or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid username or password' });

    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

// Authenticatoin Routes
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Create new user
    const newUser = new User({ username, password });

    // Save user to the database
    await newUser.save();

    // crated user session
    req.session.username = username;
    req.session.password = password;

    res.status(201).redirect('/products');
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'User does not exist' });
    }

    // Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // crated user session
    req.session.username = username;
    req.session.password = password;

    res.status(201).redirect('/products');
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Error destroying session');
    }
    res.clearCookie(req.sessionID); // Replace 'sessionID' with your session cookie name
    res.status(201).redirect('/');
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, "/views/homepage.html"));
})

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '/views/login.html'));
})

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '/views/register.html'));
})

app.get('/addItem', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/form.html'));
})
app.get('/updateItem', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/updateform.html'));
})
app.get('/deleteItem', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/deleteform.html'));
})


// Routes
// 1) Add a product
app.post('/products', authenticate, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).redirect('/products');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 2) Get all products
app.get('/products', authenticate, async (req, res) => {
  try {
    const objectOfProducts = await Product.find();
    const products = Object.keys(objectOfProducts).map(key => {
      return objectOfProducts[key];
    });
    console.log(products);
    console.log(typeof products);
    res.render(path.join(__dirname, '/views/products.ejs'), { products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3) Update a product
app.post('/updateProducts', authenticate, async (req, res) => {
  try {
    // console.log(req.params.id, req.body);
    const { productID } = req.body;
    const product = await Product.updateOne({ "productID": req.params.id }, req.body);
    // res.json(product);
    // res.send("OK");
    res.status(201).redirect('/products');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4) Delete a product
app.post('/deleteProducts', authenticate, async (req, res) => {
  try {
    const { productID } = req.body;
    await Product.deleteOne({ "productID": productID });
    res.status(201).redirect('/products');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 5) Fetch featured products
app.get('/products/featured', authenticate, async (req, res) => {
  try {
    const featuredProducts = await Product.find({ featured: true });
    res.json(featuredProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6) Fetch products with price less than a certain value
app.get('/products/price/:value', authenticate, async (req, res) => {
  try {
    const products = await Product.find({ price: { $lt: req.params.value } });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7) Fetch products with rating higher than a certain value
app.get('/products/rating/:value', authenticate, async (req, res) => {
  try {
    const products = await Product.find({ rating: { $gt: req.params.value } });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
