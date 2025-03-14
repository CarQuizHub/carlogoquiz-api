# Car Logo Quiz API

This is the **backend API** for [Car Logo Quiz](https://www.carlogoquiz.com), built using **Cloudflare Workers**, **Durable Objects**, **R1 Object Storage** and **D1 Database**. It handles quiz logic, serves dynamically generated questions, and stores user scores.

## 🛠 Tech Stack

- **Backend:** Cloudflare Workers + Durable Objects (Serverless)
- **Database:** Cloudflare D1 (SQL)
- **Storage:** Cloudflare R2 (For images & sound)
- **CI/CD:** GitHub Actions + Wrangler

## 📌 Features

- **Randomized quiz questions** based on difficulty
- **Score tracking & progression**
