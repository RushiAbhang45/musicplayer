import { AnimatePresence, motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import "./MobileDrawer.css";

// Mirrors QueuePanel's backdrop + slide-in drawer pattern, anchored from the
// left (matches the hamburger button's position in TopBar) instead of the
// right. Holds account/login - the one piece of TopBar that doesn't fit in
// BottomNav's 4 primary destinations.
export default function MobileDrawer({ isOpen, onClose }) {
  const { user, accountsEnabled, logout } = useAuth();

  function handleLogout() {
    logout();
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="mobile-drawer__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="mobile-drawer glass-card"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="mobile-drawer__header">
              <NavLink to="/" className="mobile-drawer__logo gradient-text" onClick={onClose}>
                MusicPlayer
              </NavLink>
              <button className="icon-btn" onClick={onClose} aria-label="Close menu">
                ✕
              </button>
            </div>

            {accountsEnabled && (
              <div className="mobile-drawer__account">
                {user ? (
                  <>
                    <div className="mobile-drawer__email">{user.email}</div>
                    <button className="btn" onClick={handleLogout}>
                      Log out
                    </button>
                  </>
                ) : (
                  <NavLink to="/login" className="btn btn-primary" onClick={onClose}>
                    Log in
                  </NavLink>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
