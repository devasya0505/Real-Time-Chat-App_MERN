# DevConnect

**DevConnect** is a premium, real-time MERN (MongoDB, Express, React, Node.js) collaborative workspace chat application. Featuring a flat black-and-white layout inspired by the X (formerly Twitter) platform, it includes direct messaging, group channels, mutual friend requests, real-time message ticks, interactive emoji reactions, live password checkers, and a light/dark mode switcher.

---

## 🌟 Key Features

* **Real-time Socket Engine**: Decoupled messaging structure using Socket.io, including active presence tracking, user typing indicators, and instant message deliveries.
* **Mutual Friend Matching Flow**: Send requests, accept/decline notifications, and chat only with verified mutual connections. Non-friends are hidden from search lists for privacy.
* **WhatsApp-style Message Ticks**: Visual feedback on message delivery status (Single gray tick for *Sent*, Double gray tick for *Delivered*, and Sky-blue double tick for *Read*).
* **Unread Message Badges**: DM items in the sidebar display dynamic circular unread message badges. Selecting a chat instantly clears badges in database and local state.
* **Centered Modals with Bouncy Transitions**: Dialog panels for profile configurations and logouts are center-aligned with cubic-bezier pop-up scale entrance animations.
* **Full Mobile Responsiveness**:
  * **Hamburger Menus**: Easily toggle the sidebar visibility on mobile devices.
  * **Lock Prevention**: Automatic viewport resetting triggers the sidebar visibility if there's no active room, preventing users from getting stuck on blank welcome screens.
  * **Absolute Overlay Sidebar**: Channel members list overlays cleanly on mobile, rather than resizing or breaking page structures.
  * **Scrollable Auth Layouts**: Vertical scrolling is enabled on login/signup forms for shorter screen dimensions.
* **Theme Customizer**: Select either Dark Mode (default) or Light Mode in the profile settings, which flips all borders and panel aesthetics to match clean X branding. Preferences are saved in `localStorage`.
* **Cross-Tab Sync Auto-Logout**: To prevent leftover sessions, reopening/refreshing the application forces a session logout, and utilizes a `BroadcastChannel` to automatically log out other active browser tabs.

---

## 🛠️ Technology Stack

* **Frontend**: React (Vite), lucide-react icons, Vanilla CSS.
* **Backend**: Node.js, Express, Socket.io.
* **Database**: MongoDB (Mongoose schemas).
* **Authentication**: JSON Web Token (JWT) authorization headers.

---

## 📂 Project Structure

```text
2_Basic-Chat-Application/
├── backend/
│   ├── src/
│   │   ├── config/       # Database configuration
│   │   ├── controllers/  # Auth, Room, Message, and Friend Controllers
│   │   ├── middleware/   # Protected JWT authentication routes
│   │   ├── models/       # Mongoose Schemas (User, Room, Message, FriendRequest)
│   │   ├── routes/       # Express Route endpoints
│   │   ├── sockets/      # Socket.io connection and event handlers
│   │   └── server.js     # Entry point
│   ├── .env              # Environment configurations
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── assets/       # Static assets
│   │   ├── components/   # AuthPage, ChatDashboard, MessageBubble
│   │   ├── context/      # AuthContext, SocketContext
│   │   ├── App.jsx
│   │   ├── index.css     # Clean black-and-white design layout stylesheet
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18+)
* **MongoDB** (running locally or a MongoDB Atlas URI string)

### 1. Database & Server Setup (Backend)
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/devconnect
   JWT_SECRET=supersecretchatkey123!
   ```
4. Start the server in development mode:
   ```bash
   npm run dev
   ```
   *The server runs on [http://localhost:5000](http://localhost:5000).*

### 2. Client Setup (Frontend)
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend/` directory:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The client runs on [http://localhost:5173](http://localhost:5173).*

---

## 🧪 Quick Test Checklist

1. **Password Checker**: Register a new account. Notice the real-time strength feedback and green/red matching indicators below the confirm password box.
2. **Auto-Logout**: Log in. Open a new tab or refresh the page. Confirm the tab logs out and prompts the login screen. Check other tabs—they will also sync-logout immediately.
3. **Friend Request**: Register two users. Send a friend request. Confirm a notification badge appears on the recipient's screen in real-time. Direct messages unlock only after the request is accepted.
4. **Theme Toggling**: Click Settings in the bottom-left profile area. Select "Use Light Mode" and verify that components, borders, and inputs swap to a light black-and-white theme.
5. **Mobile Views**: Shrink the viewport (<= 768px). Select a room, click the top-left hamburger menu to slide open the sidebar, and close the chat to return to the sidebar automatically.
