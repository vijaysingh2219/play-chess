export interface DisplayUser {
  id: string;
  name?: string | null;
  username?: string | null;
  image: string | null;
  rating?: number | null;
  createdAt?: Date | null;
}
