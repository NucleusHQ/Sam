import express from 'express';
import { NlpManager } from 'node-nlp';
import fs from 'fs';

const app = express();
const port = 3000;
const data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));
const database = JSON.parse(fs.readFileSync('database.json', 'utf-8'));

const manager = new NlpManager({ languages: ['en'] });

function addDocumentsAndAnswers(manager, intent, questions, answers) {
  questions.forEach((question, index) => {
    manager.addDocument('en', question, intent);
    manager.addAnswer('en', intent, answers[index]);
  });
}

addDocumentsAndAnswers(manager, 'greeting', data.greetings.questions, data.greetings.answers);
addDocumentsAndAnswers(manager, 'purchase_product', data.purchase_product.questions, data.purchase_product.answers);


manager.addNamedEntityText('UsageType', 'gaming');
manager.addNamedEntityText('UsageType', 'photography');
manager.addNamedEntityText('UsageType', 'social media');
manager.addNamedEntityText('UsageType', 'general usage');



async function trainNLPModel() {
  await manager.train();
  manager.save();
}

async function handleGreetingIntent() {
  const randomResponseIndex = Math.floor(Math.random() * data.greetings.answers.length);
  return data.greetings.answers[randomResponseIndex];
}

async function handlePurchaseProductIntent() {
  const { products } = database;
  const randomResponseIndex = Math.floor(Math.random() * data.purchase_product.answers.length);
  const responseMessage = data.purchase_product.answers[randomResponseIndex];

  const productsList = products.map((product) => ({
    name: product.name,
    'base-price': product['base-price'],
    salesCount: product.salesCount
  }));

  return {
    message: "Okay, great! Let's get started. \n Here are the top sellers. Select an option below",
    data: productsList
  };
}

async function respondToUserInput(input) {
  const response = await manager.process('en', input);
  let responseMessage = 'Didn\'t understand you there!';
  let responseData = null;

  if (response && response.intent === 'greeting') {
    responseMessage = await handleGreetingIntent();
  } else if (response.intent === 'purchase_product') {
    const productResponse = await handlePurchaseProductIntent();
    responseMessage = productResponse.message;
    responseData = productResponse.data;
  }

  return {
    message: responseMessage,
    data: responseData,
  };
}

app.get('/api/nlp', (req, res) => {
  const userMessage = req.query.message;
  respondToUserInput(userMessage).then((botResponse) => res.send(botResponse))
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    });
});


app.get("/api/unsure/:type", (req, res) => {
    const {storage} = req.params.type;
    res.send({
        message: "No problem. Tell me what you'll be using the phone for. I'll suggest what's best for you", 
        data: null
    })
});


app.get('/api/products/:product_id/colors', (req, res) => {
  const productId = req.params.product_id;
  const product = database.products.find((p) => p.name === productId);

  if (!product) {
    res.status(404).json({
      message: 'Product not found. Would you like to select another product?',
      data: null
    });
  } else if (!product.colors) {
    res.status(404).json({ message: 'No color options available for this product' });
  } else {
    res.json({
      message: 'Great choice! Pick a color now.',
      data: product.colors,
    });
  }
});

app.get('/api/products/:product_id/storage', (req, res) => {
  const productId = req.params.product_id;
  const product = database.products.find((p) => p.name === productId);

  if (!product) {
    res.status(404).json({
      message: 'Product not found. Would you like to select another product?',
      data: null,
    });
  } else if (product.storage.length == 0) {
    res.status(404).json({ message: 'No storage options available for this product' });
  } else {
    res.json({
      message: 'Great color choice! Pick a storage option.',
      data: product.storage,
    });
  }
});

app.get('/api/recommend-storage', (req, res) => {
    const userMessage = req.query.message;
  
    manager.process('en', userMessage).then((response) => {

        if (response && response.intent && response.entities) {

            const userIntention = response.intent;
        const userEntities = response.entities;
  
        if (userIntention === 'intended-usage') {
          const usageTypes = userEntities.map((entity) => entity.body);
  
          const recommendedStorage = determineStorageBasedOnUsage(usageTypes);
  
          res.json({
            message: `Based on your intended usage for ${usageTypes.join(', ')}, we recommend the following storage options.`,
            recommendedStorage: recommendedStorage,
          });
        } else {
          res.json({ message: "I'm not sure how to assist with this intention." });
        }
      } else {
        res.json({ message: "I didn't understand your request." });
      }
    });
  });
  
function determineStorageBasedOnUsage(usageTypes) {

if (usageTypes.includes('gaming')) {
    return '256GB'; 
} else if (usageTypes.includes('photography')) {
    return '512GB'; 
} else if (usageTypes.includes('social media')) {
    return '128GB'; 
} else if (usageTypes.includes('general usage')) {
    return '256GB'; 
} else {
    return '128GB'; 
}
}

app.listen(3000, () => {
console.log("Server is up!");
});
  

trainNLPModel().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});




manager.addDocument('en', `I'm into gaming`, 'intended-usage', { entities: [{ start: 10, end: 15, entity: 'UsageType', body: 'gaming' }] });
manager.addDocument('en', 'I want to use it for social media', 'intended-usage', { entities: [{ start: 23, end: 34, entity: 'UsageType', body: 'social media' }] });
manager.addDocument('en', 'I need it for general usage', 'intended-usage', { entities: [{ start: 21, end: 33, entity: 'UsageType', body: 'general usage' }] });
manager.addDocument('en', 'Photography is my thing', 'intended-usage', { entities: [{ start: 0, end: 12, entity: 'UsageType', body: 'photography' }] });
manager.addDocument('en', 'I plan to use it for both gaming and photography', 'intended-usage', { entities: [{ start: 26, end: 31, entity: 'UsageType', body: 'gaming' }, { start: 36, end: 47, entity: 'UsageType', body: 'photography' }] });
manager.addDocument('en', 'I need it for gaming, mainly', 'intended-usage', { entities: [{ start: 15, end: 20, entity: 'UsageType', body: 'gaming' }] });
manager.addDocument('en', 'Photography and gaming are my interests', 'intended-usage', { entities: [{ start: 0, end: 12, entity: 'UsageType', body: 'photography' }, { start: 17, end: 22, entity: 'UsageType', body: 'gaming' }] });
manager.addDocument('en', 'I want to use it for general purposes', 'intended-usage', { entities: [{ start: 21, end: 33, entity: 'UsageType', body: 'general usage' }] });
manager.addDocument('en', 'My primary use is social media', 'intended-usage', { entities: [{ start: 23, end: 34, entity: 'UsageType', body: 'social media' }] });
manager.addDocument('en', 'I need a phone for gaming and general usage', 'intended-usage', { entities: [{ start: 15, end: 20, entity: 'UsageType', body: 'gaming' }, { start: 25, end: 37, entity: 'UsageType', body: 'general usage' }] });
manager.addDocument('en', 'I plan to use it for photography and social media', 'intended-usage', { entities: [{ start: 26, end: 37, entity: 'UsageType', body: 'photography' }, { start: 42, end: 53, entity: 'UsageType', body: 'social media' }] });
manager.addDocument('en', 'My interests are gaming, photography, and social media', 'intended-usage', { entities: [{ start: 15, end: 20, entity: 'UsageType', body: 'gaming' }, { start: 26, end: 37, entity: 'UsageType', body: 'photography' }, { start: 42, end: 53, entity: 'UsageType', body: 'social media' }] });
manager.addDocument('en', 'General usage and gaming', 'intended-usage', { entities: [{ start: 0, end: 12, entity: 'UsageType', body: 'general usage' }, { start: 17, end: 22, entity: 'UsageType', body: 'gaming' }] });
manager.addDocument('en', 'I want to use it for general purposes and social media', 'intended-usage', { entities: [{ start: 21, end: 33, entity: 'UsageType', body: 'general usage' }, { start: 38, end: 49, entity: 'UsageType', body: 'social media' }] });
manager.addDocument('en', 'Gaming and photography are my main uses', 'intended-usage', { entities: [{ start: 0, end: 11, entity: 'UsageType', body: 'gaming' }, { start: 16, end: 27, entity: 'UsageType', body: 'photography' }] });
