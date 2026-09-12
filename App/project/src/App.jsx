import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { Hero, Services as LandingServices, Footer } from "./LandingPage";
import { Header } from "./Header.jsx";
import SmartReminder from "./components/SmartReminder";
import ServicesPage from "./ServicesPage";
import ServiceChatPage from "./ServiceChatPage";
import Login from "./Login";
import Signup from "./SignUp";
import ContactUs from "./ContactUs";
import AboutUs from "./AboutUs";
import Resources from "./Resources";
import VirtualCourtroomPage from "./courtroom/VirtualCourtroomPage";
import { supabase } from "./supabase";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";

const AuthGuard = ({ user, title = "Login required", message = "Please log in or sign up to access this section.", children }) => {
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-black text-white px-6">
        <div className="max-w-lg w-full bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl space-y-4 text-center">
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-slate-200">{message}</p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg font-semibold bg-white/10 border border-white/20 hover:bg-white/20 transition"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 rounded-lg font-semibold bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:shadow-lg hover:shadow-purple-500/20 transition"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const apiUrl = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <AppLayout user={user} />
      </Router>
    </I18nextProvider>
  );
}

const AppLayout = ({ user }) => {
  const location = useLocation();
  const showSmartReminder = Boolean(user) && location.pathname === "/";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <>
      <Header user={user} />
      {showSmartReminder && <SmartReminder />}
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Hero />
              <LandingServices />
            </>
          }
        />
        <Route
          path="/services"
          element={
            <AuthGuard
              user={user}
              title="Login required"
              message="Please log in or sign up to access our services."
            >
              <ServicesPage />
            </AuthGuard>
          }
        />
        <Route
          path="/service-chat/:serviceTitle"
          element={
            <AuthGuard
              user={user}
              title="Login required"
              message="Please log in or sign up to access this service."
            >
              <ServiceChatPage />
            </AuthGuard>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/about" element={<AboutUs />} />
        <Route
          path="/virtual-courtroom"
          element={
            <AuthGuard
              user={user}
              title="Login required"
              message="Please log in or sign up to access the Virtual Courtroom experience."
            >
              <VirtualCourtroomPage />
            </AuthGuard>
          }
        />
      </Routes>
      <Footer />
    </>
  );
};

export default App;
