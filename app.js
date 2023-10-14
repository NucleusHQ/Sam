import express from 'express';
import { NlpManager } from 'node-nlp';
import fs from 'fs';
import cors from 'cors';

const app = express();
const port = 3000;
const data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));
const database = JSON.parse(fs.readFileSync('database.json', 'utf-8'));
app.use(express.json());
app.use(cors());

const manager = new NlpManager({ languages: ['en'] });

function addDocumentsAndAnswers(manager, intent, questions, answers) {
  questions.forEach((question, index) => {
    manager.addDocument('en', question, intent);
    manager.addAnswer('en', intent, answers[index]);
  });
}

addDocumentsAndAnswers(manager, 'greeting', data.greetings.questions, data.greetings.answers);
addDocumentsAndAnswers(manager, 'purchase_product', data.purchase_product.questions, data.purchase_product.answers);
addDocumentsAndAnswers(manager, 'confused', data.confused.questions, data.confused.answers);



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
  return data.greetings.answers[randomResponseIndex]
}

async function handlePurposeIntent() {
  const randomResponseIndex = Math.floor(Math.random() * data.purpose.answers.length);
  return data.purpose.answers[randomResponseIndex];
}


async function handlePurchaseProductIntentByEntity(entities) {
  const { products } = database;

  const productList = products.filter((product) => product.features.includes(entities[0]));

  return {
    message: `I got you covered. Here's the best phone for ${entities[0]}`,
    data: productList.slice(0, 1)
  };
}


async function respondToUserInput(input) {
  
  const response = await manager.process('en', input);
  const {intent} = response || {};

  const body = {
    message: "", 
    payload: {
      type: "", 
      data: [], 
      meta: {}
    }
  }

  switch(intent) {
    case "greeting": { 

      const text = await handleGreetingIntent();
      body.message = text;
      
      break;

    }

    case "purchase_product": {

      const {message, data} = await handlePurchaseProductIntentByEntity(["gaming"]);

      body.message = message; 
      body.payload.data = data;
      body.payload.type = "product";

      break;
    }

    case "confused": {

      const {answer: message} = response.answers[0]
      body.message = message;

      break;

    }

    case "intended-usage": {

      const text = await handlePurposeIntent();

      body.message = text; 

      const keywordsList = ["gaming", "camera", "battery", "social media", "performance", "long-lasting", "life", "sound", "fast-charging"];
      const keywords =  checkKeywords(text, keywordsList); 

      body.payload.data = keywords;

      body.payload.meta = {
        variant: determineStorageBasedOnUsage(keywords)
      }

      body.payload.type = "requirements"

      break;

    }
  }

  return body
}

app.post('/api/nlp', (req, res) => {
  const { message: userMessage } = req.body || {}
  respondToUserInput(userMessage).then((botResponse) => res.send(botResponse))
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    });
});


function checkKeywords(message, keywordsList) {

  let keywordsPresent = [];
  const lowerCaseMessage = message.toLowerCase();

  for (const keyword of keywordsList) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i'); 
    if (lowerCaseMessage.match(regex)) {
      keywordsPresent.push(keyword);
    }
  }

  return ["gaming", "camera", "battery", "social media"];
}

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

manager.addDocument(
  'en',
  'I want to buy the best phone you have for gaming',
  'purchase_product',
  {
    entities: [{
      start: 42,
      end: 48,
      entity: 'product',
      body: 'gaming'
    }]
  }
);

manager.addNamedEntityText('product', 'gaming', ['en'], ['gaming']);

trainNLPModel().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});


manager.addDocument('en', "Taking a lot of pictures, using social media and playing some heavy games.", 'intended-usage', { entities: [{ start: 10, end: 15, entity: 'UsageType', body: 'gaming' }] });
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


function checkWordUsage(text, word) {
  const regex = new RegExp(`\\b${word}\\b`, 'i'); 
  const matches = text.match(regex); 
  if (matches) {
    return true; 
  }
  return false; 
}

