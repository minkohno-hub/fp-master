import { HashRouter, Route, Routes } from 'react-router';
import { ContentProvider } from './content/store';
import { Layout } from './ui/Layout';
import { HomePage } from './pages/Home';
import { PracticePage } from './pages/Practice';
import { SessionPage, SessionResultPage } from './pages/Session';
import { QuestionDetailPage, QuestionListPage } from './pages/Questions';
import { CalcHomePage, CalcRunPage } from './pages/Calc';
import { GlossaryPage, TermPage } from './pages/Glossary';
import { CardsHomePage, CardsRunPage } from './pages/Cards';
import { ReviewPage } from './pages/Review';
import { MockHomePage, MockResultPage, MockRunPage } from './pages/Mock';
import { StatsPage } from './pages/Stats';
import { PlanPage } from './pages/Plan';
import { BookmarksPage } from './pages/Bookmarks';
import { HistoryPage } from './pages/History';
import { SettingsPage } from './pages/Settings';
import { DataPage } from './pages/Data';
import { LawPage } from './pages/Law';
import { MenuPage, AboutPage, NotFoundPage } from './pages/Menu';
import { MistakesPage } from './pages/Mistakes';

export function App() {
  return (
    <HashRouter>
      <ContentProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="session/:id" element={<SessionPage />} />
            <Route path="session/:id/result" element={<SessionResultPage />} />
            <Route path="questions" element={<QuestionListPage />} />
            <Route path="q/:id" element={<QuestionDetailPage />} />
            <Route path="calc" element={<CalcHomePage />} />
            <Route path="calc/run/:gen" element={<CalcRunPage />} />
            <Route path="glossary" element={<GlossaryPage />} />
            <Route path="glossary/:id" element={<TermPage />} />
            <Route path="cards" element={<CardsHomePage />} />
            <Route path="cards/run" element={<CardsRunPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="mock" element={<MockHomePage />} />
            <Route path="mock/run/:id" element={<MockRunPage />} />
            <Route path="mock/result/:id" element={<MockResultPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="plan" element={<PlanPage />} />
            <Route path="bookmarks" element={<BookmarksPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="mistakes" element={<MistakesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="data" element={<DataPage />} />
            <Route path="law" element={<LawPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ContentProvider>
    </HashRouter>
  );
}
