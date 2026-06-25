# 📚 Fable - Backend API

Express.js server for Fable Ebook Sharing Platform.

## 🚀 Live Server
https://fable-server-vygh.onrender.com
 

## 📡 API Endpoints

### Ebooks

| Method | Endpoint               | Description                                             |
| ------ | ---------------------- | ------------------------------------------------------- |
| GET    | `/api/ebooks`          | All published ebooks (search, filter, sort, pagination) |
| GET    | `/api/ebooks/featured` | Latest 6 published ebooks                               |
| GET    | `/api/ebooks/:id`      | Single ebook details                                    |
| POST   | `/api/ebooks`          | Create new ebook                                        |
| PUT    | `/api/ebooks/:id`      | Update ebook                                            |
| DELETE | `/api/ebooks/:id`      | Delete ebook                                            |

### Dashboard

| Method | Endpoint                        | Description      |
| ------ | ------------------------------- | ---------------- |
| GET    | `/api/dashboard/stats`          | Admin stats      |
| GET    | `/api/dashboard/users`          | All users        |
| PUT    | `/api/dashboard/users/role`     | Update user role |
| DELETE | `/api/dashboard/users`          | Delete user      |
| GET    | `/api/dashboard/writer/ebooks`  | Writer's ebooks  |
| GET    | `/api/dashboard/writer/sales`   | Writer's sales   |
| GET    | `/api/dashboard/user/purchases` | User's purchases |
| GET    | `/api/dashboard/transactions`   | All transactions |

### Bookmarks

| Method | Endpoint         | Description      |
| ------ | ---------------- | ---------------- |
| GET    | `/api/bookmarks` | User's bookmarks |
| POST   | `/api/bookmarks` | Add bookmark     |
| DELETE | `/api/bookmarks` | Remove bookmark  |

### Payment

| Method | Endpoint                 | Description                     |
| ------ | ------------------------ | ------------------------------- |
| POST   | `/api/create-payment`    | Create Stripe checkout session  |
| POST   | `/api/complete-purchase` | Complete purchase after payment |

### Upload

| Method | Endpoint      | Description           |
| ------ | ------------- | --------------------- |
| POST   | `/api/upload` | Upload image to imgBB |

## 🛠️ Tech Stack

- Express.js
- MongoDB + Mongoose
- Stripe
- Multer

## ⚙️ Environment Variables
