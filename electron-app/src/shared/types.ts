export type LocateRequest = {
  image: string;
  query: string;
};

export type LocateResponse = {
  bbox: [number, number, number, number];
  explanation: string;
};
