function timeToMinutes(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return 0;
  }
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

module.exports = {
  timeToMinutes,
  minutesToTime
};