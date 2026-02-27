# Responsive Design Verification Checklist

## Mobile - 320px (iPhone SE)
- [ ] FlightHistory
  - [ ] Flight list readable with wrapped text
  - [ ] Flight cards stack properly
  - [ ] Details panel displays full width
  - [ ] Edit/Delete buttons accessible
  - [ ] 3D viewer container responsive

- [ ] Analytics
  - [ ] Stats cards single column
  - [ ] Charts full width
  - [ ] All text readable
  - [ ] Buttons large enough to tap (44px min)

- [ ] Navigation
  - [ ] Header readable
  - [ ] Nav links accessible

## Mobile - 375px (iPhone 12)
- [ ] FlightHistory single column
- [ ] Analytics single column
- [ ] Stats cards 1-2 per row
- [ ] Charts render correctly
- [ ] Touch targets adequate

## Mobile - 480px (Small Phone Landscape)
- [ ] Layout adapts smoothly
- [ ] No horizontal scroll
- [ ] Readable typography
- [ ] Interactive elements accessible

## Tablet - 768px (iPad Portrait)
- [ ] FlightHistory optimized layout
- [ ] Analytics 2-column grid
- [ ] Stats cards 2-3 per row
- [ ] Charts side-by-side where appropriate
- [ ] Navigation horizontal

## Tablet - 1024px (iPad Landscape)
- [ ] FlightHistory two-column layout
- [ ] Analytics full grid
- [ ] Stats cards 4 per row
- [ ] All charts visible
- [ ] Proper spacing

## Desktop - 1280px
- [ ] FlightHistory optimal layout (350px list + fluid viewer)
- [ ] Analytics full grid (2 columns for charts)
- [ ] Stats cards 4-5 per row
- [ ] Hover states work
- [ ] Max-width containers (1600px)

## Desktop - 1600px+
- [ ] Content centered with max-width
- [ ] No excessive whitespace
- [ ] Optimal reading width
- [ ] Charts scale appropriately

## Browser Testing
- [ ] Chrome (desktop + mobile)
- [ ] Firefox (desktop)
- [ ] Safari (desktop + iOS)
- [ ] Edge (desktop)

## Device Testing (if available)
- [ ] Real iPhone
- [ ] Real Android phone
- [ ] Real iPad
- [ ] Real Android tablet

## Accessibility
- [ ] Keyboard navigation works on all sizes
- [ ] Touch targets ≥44px on mobile
- [ ] Text readable at all sizes
- [ ] Focus indicators visible
- [ ] ARIA labels correct

## Performance
- [ ] Smooth scrolling on all devices
- [ ] No layout shifts
- [ ] Images/charts load properly
- [ ] Lazy loading works

## Notes
Use browser DevTools responsive mode or:
- Chrome: Cmd+Shift+M (Mac) / Ctrl+Shift+M (Windows)
- Firefox: Cmd+Opt+M (Mac) / Ctrl+Shift+M (Windows)

Or Playwright visual test:
```bash
npm run test:e2e -- --project="Mobile Chrome"
npm run test:e2e -- --project="iPad"
```
