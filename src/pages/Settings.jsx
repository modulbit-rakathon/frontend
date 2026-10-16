// Obrazovka: Nastavení (velikost písma a jazyk)
import FontSizeSwitch from '../components/FontSizeSwitch.jsx';
import LanguageSwitch from '../components/LanguageSwitch.jsx';
import { t } from '../i18n/index.js';
import BackButton from '../components/BackButton.jsx';

export default function Settings() {
  return (
    <>
      <BackButton to="/" />
      <h1>{t('settings.title')}</h1>
      <p className="subtitle">{t('settings.subtitle')}</p>

      <FontSizeSwitch />
      <LanguageSwitch />
    </>
  );
}