/**
 * Types API partagés pour le frontend eMDB.
 * Alignés sur les réponses NestJS.
 */

export type ApiResponse<T> = {
  data: T;
  message?: string;
};

export type PaginationResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type User = {
  id: string;
  email: string;
  pseudo: string;
  avatarUrl?: string;
  createdAt: string;
};

export type AuthenticatedUser = User;

export type Title = {
  id: string;
  tmdbId?: number;
  titre: string;
  titreOriginal?: string;
  type: "film" | "serie";
  dateSortie?: string;
  duree?: number;
  note?: number;
  synopsis?: string;
  afficheUrl?: string;
  backdropUrl?: string;
  statut?: string;
  genres?: Genre[];
  pays?: Country[];
};

export type Person = {
  id: string;
  tmdbId?: number;
  nom: string;
  photoUrl?: string;
  dateNaissance?: string;
  pays?: string;
  biographie?: string;
  wikiUrl?: string;
};

export type Episode = {
  id: string;
  titre: string;
  numero: number;
  dateSortie?: string;
  duree?: number;
  synopsis?: string;
  stillUrl?: string;
  saison?: Season;
};

export type Season = {
  id: string;
  numero: number;
  titre?: string;
  dateSortie?: string;
  synopsis?: string;
  posterUrl?: string;
  episodes?: Episode[];
};

export type Credit = {
  id: string;
  role: string;
  person?: Person;
};

export type Genre = {
  id: string;
  nom: string;
};

export type Country = {
  id: string;
  nom: string;
};

export type UserWatch = {
  id: string;
  date: string;
  title?: Title;
  episode?: Episode;
};

export type UserRating = {
  id: string;
  note: number;
  commentaire?: string;
  createdAt: string;
  title?: Title;
  episode?: Episode;
};

export type UserList = {
  id: string;
  nom: string;
  type: "watchlist" | "favoris" | "custom";
  description?: string;
  items?: Title[];
  shares?: ListShare[];
};

export type ListShare = {
  id: string;
  permission: "read" | "write";
  user?: User;
};

export type Notification = {
  id: string;
  type: string;
  lu: boolean;
  message: string;
  createdAt: string;
  episodeId?: string;
  titleId?: string;
};
