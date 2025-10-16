# Expense Management System

A modern, full-stack expense management application built with React, TypeScript, and Node.js. Features comprehensive transaction tracking, category management, and real-time reporting with a clean, intuitive interface.

## 🚀 Features

- **✅ Modern Authentication System** - Secure login with role-based access (Admin/User)
- **✅ Real-time Dashboard** - Live expense tracking with visual budget progress
- **✅ Transaction Management** - Add, edit, and categorize transactions with smart suggestions
- **✅ Category Management** - Full CRUD operations for expense categories and subcategories
- **✅ Multi-language Support** - German and English localization with i18next
- **✅ Euro Currency Support** - Proper German locale formatting (€)
- **✅ Responsive Design** - Modern UI with Tailwind CSS and clean color scheme
- **✅ Real-time Updates** - React Query for optimistic updates and caching
- **🚧 CSV Import/Export** - Data import/export functionality (in progress)
- **🚧 OneDrive Backup** - Automated database backups (planned)

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **React Query** - Server state management and caching
- **React Router** - Client-side routing
- **i18next** - Internationalization (German/English)
- **Lucide React** - Modern icon library

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type-safe backend development
- **SQLite** - Lightweight database
- **Better-SQLite3** - Synchronous SQLite driver

### Development Tools
- **Vite** - Fast build tool and dev server
- **Concurrently** - Run multiple commands
- **TSX** - TypeScript execution
- **ESLint** - Code linting

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/expense-management-system.git
   cd expense-management-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3003/api

## 🔧 Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run client:dev` - Start only the frontend (Vite)
- `npm run server:dev` - Start only the backend (Express)
- `npm run build` - Build for production
- `npm run client:build` - Build frontend only
- `npm run server:build` - Build backend only
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🏗️ Project Structure

```
expense-management-system/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   │   ├── AuthContext.tsx
│   │   ├── Dashboard.tsx
│   │   ├── CategoryManager.tsx
│   │   ├── TransactionForm.tsx
│   │   └── ...
│   ├── utils/             # Utility functions
│   └── index.css          # Global styles
├── server/                # Backend source code
│   ├── routes/            # API routes
│   │   ├── categories.ts
│   │   ├── transactions.ts
│   │   └── reports.ts
│   ├── database.ts        # Database configuration
│   └── index.ts           # Server entry point
├── public/                # Static assets
└── package.json
```

## 🔑 Authentication

Demo credentials for testing:
- **Admin**: username: `admin`, password: `admin123`
- **User**: username: `user`, password: `user123`

## 🌐 API Endpoints

### Categories
- `GET /api/categories` - Get all categories with subcategories
- `POST /api/categories` - Create new category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Transactions
- `GET /api/transactions` - Get transactions with filtering
- `POST /api/transactions` - Create new transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Reports
- `GET /api/reports/dashboard` - Get dashboard statistics
- `GET /api/reports/monthly` - Get monthly reports
- `GET /api/reports/export` - Export transactions as CSV

## 🎨 Features Overview

### Dashboard
- Monthly spending overview
- Budget progress tracking
- Recent transactions list
- Quick transaction entry

### Category Management
- Create, edit, and delete categories
- Subcategory support
- Color coding for categories
- Category examples for smart suggestions

### Transaction Management
- Add transactions with autocomplete
- Category and subcategory selection
- Date and amount validation
- Notes and description fields

### Multi-language Support
- German (Deutsch) and English
- Real-time language switching
- Proper currency formatting for German locale

## 🚀 Deployment

The application is containerized and ready for deployment:

1. **Build for production**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

## 📋 Development Roadmap

- [ ] **OneDrive Integration** - Automated database backups
- [ ] **Enhanced CSV Import** - Full import functionality with validation
- [ ] **PWA Features** - Offline support with service workers
- [ ] **Advanced Reporting** - Charts and analytics
- [ ] **User Management** - Admin panel for user control
- [ ] **Mobile App** - React Native companion app

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**eberh** - [GitHub Profile](https://github.com/yourusername)

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by the need for personal expense tracking
- UI design influenced by modern fintech applications