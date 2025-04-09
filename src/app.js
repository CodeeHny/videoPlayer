import express from 'express';
import cors from 'cors';
import cookieParser from "cookie-parser";


const app = express();

app.use(cors({
    origin:process.env.CORS_ORIGIN
}));

app.use(express.json({limit:"16kb"}));
app.use(express.urlencoded({extended:true}));
app.use(express.static("public"));
app.use(cookieParser());

// CORS setup
app.use(cors({
    origin: "http://localhost:4000",   // or whatever client you're using
    credentials: true                  // This allows cookies to be sent
  }));

// Routes imports
import testRouter from './routes/test.route.js'
import userRouter from './routes/user.route.js'

// Route declaration
app.use('/test', testRouter);
app.use('/api/v1/user', userRouter)

export default app