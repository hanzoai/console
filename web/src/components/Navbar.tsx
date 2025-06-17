import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MobileMenu } from "./navigation/MobileMenu";
import Logo from "./navigation/Logo";
import DesktopNav from "./navigation/DesktopNav";
import AuthButtons from "./navigation/AuthButtons";
import NavbarContainer from "./navigation/NavbarContainer";

const isAccountRoute = () => {
  return window.location.pathname.startsWith('/account') || 
    window.location.pathname === '/dashboard' || 
    window.location.pathname === '/user-profile' || 
    window.location.pathname === '/organization-profile';
};

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  
  useEffect(() => {
    if (!isAccountRoute()) {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <NavbarContainer isScrolled={isScrolled}>
      <div className="flex items-center w-full">
        {/* Logo - Fixed width */}
        <div className="flex-shrink-0">
          <Logo />
        </div>
        
        {/* Navigation - Centered */}
        <div className="flex-1 flex justify-center">
          <DesktopNav />
        </div>
        
        {/* Auth Buttons - Fixed width */}
        <div className="flex-shrink-0">
          <AuthButtons user={user} />
        </div>
        
        {/* Mobile Menu */}
        <MobileMenu 
          isOpen={isMobileMenuOpen}
          onToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
      </div>
    </NavbarContainer>
  );
};

export default Navbar;