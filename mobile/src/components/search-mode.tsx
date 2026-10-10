import { createContext, useContext } from 'react';
export const SearchModeContext = createContext({ active: false, setActive: (_active: boolean) => {} });
export const useSearchMode = () => useContext(SearchModeContext);
