export const HOTELS = {
  KASHI: {
    name: 'Hotel in Kashi',
    rooms: ['101', '102', '103', '104', '105']
  },
  VARANASI: {
    name: 'Hotel in Varanasi',
    rooms: ['201', '202', '203', '204', '205', '301', '302']
  }
};

export const getHotelByRoom = (roomNumber: string) => {
  if (HOTELS.KASHI.rooms.includes(roomNumber)) return 'KASHI';
  if (HOTELS.VARANASI.rooms.includes(roomNumber)) return 'VARANASI';
  return null;
};
