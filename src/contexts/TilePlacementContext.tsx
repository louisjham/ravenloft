import { createContext, useContext } from 'react';

export const TilePlacementContext = createContext<{
  confirmPlacement: () => void;
  cancelPlacement: () => void;
}>({
  confirmPlacement: () => {},
  cancelPlacement: () => {},
});

export const useTilePlacement = () => useContext(TilePlacementContext);
