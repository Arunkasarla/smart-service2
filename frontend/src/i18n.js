import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// the translations
const resources = {
  en: {
    translation: {
      "Explore Services": "Explore Services",
      "Log In": "Log In",
      "Sign Up": "Sign Up",
      "Bookings": "Bookings",
      "Dashboard": "Dashboard",
      "Admin Panel": "Admin Panel",
      "Smart Service": "Smart Service",
      "Find Your Pro": "Find Your Pro",
      "Top-rated professionals are ready to help.": "Top-rated professionals are ready to help.",
      "Filters": "Filters",
      "Categories": "Categories",
      "All": "All",
      "View Mode": "View Mode",
      "List": "List",
      "Map": "Map",
      "Book Now": "Book Now",
      "Recommended Providers": "Recommended Providers",
      "Account": "Account"
    }
  },
  hi: {
    translation: {
      "Explore Services": "सेवाएँ देखें",
      "Log In": "लॉग इन करें",
      "Sign Up": "साइन अप करें",
      "Bookings": "बुकिंग्स",
      "Dashboard": "डैशबोर्ड",
      "Admin Panel": "व्यवस्थापक पैनल",
      "Smart Service": "स्मार्ट सेवा",
      "Find Your Pro": "अपना पेशेवर खोजें",
      "Top-rated professionals are ready to help.": "शीर्ष श्रेणी के पेशेवर मदद के लिए तैयार हैं।",
      "Filters": "फिल्टर",
      "Categories": "श्रेणियाँ",
      "All": "सभी",
      "View Mode": "दृश्य मोड",
      "List": "सूची",
      "Map": "नक्शा",
      "Book Now": "अभी बुक करें",
      "Recommended Providers": "अनुशंसित प्रदाता",
      "Account": "खाता"
    }
  },
  te: {
    translation: {
      "Explore Services": "సేవలను అన్వేషించండి",
      "Log In": "లాగిన్ చేయండి",
      "Sign Up": "సైన్ అప్ చేయండి",
      "Bookings": "బుకింగ్‌లు",
      "Dashboard": "డాష్‌బోర్డ్",
      "Admin Panel": "అడ్మిన్ ప్యానెల్",
      "Smart Service": "స్మార్ట్ సర్వీస్",
      "Find Your Pro": "మీ ప్రోని కనుగొనండి",
      "Top-rated professionals are ready to help.": "టాప్-రేటెడ్ నిపుణులు సిద్ధంగా ఉన్నారు.",
      "Filters": "ఫిల్టర్లు",
      "Categories": "వర్గాలు",
      "All": "అన్ని",
      "View Mode": "వీక్షణ మోడ్",
      "List": "జాబితా",
      "Map": "మ్యాప్",
      "Book Now": "ఇప్పుడే బుక్ చేయండి",
      "Recommended Providers": "సిఫార్సు చేయబడిన ప్రొవైడర్లు",
      "Account": "ఖాతా"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
