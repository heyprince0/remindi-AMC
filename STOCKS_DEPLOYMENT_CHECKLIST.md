# Stocks Module - Deployment Checklist

## Pre-Deployment

### Database Setup
- [ ] Run `remindi-stocks-schema.sql` in Supabase SQL editor
- [ ] Verify all 7 tables created:
  - [ ] inventory_categories
  - [ ] inventory_suppliers
  - [ ] inventory_items
  - [ ] inventory_stock_movements
  - [ ] inventory_technician_stock
  - [ ] service_parts_used
  - [ ] contract_recommended_parts
- [ ] Verify all indexes created
- [ ] Verify RLS policies enabled on all tables
- [ ] Verify `deduct_stock_for_service()` RPC function created
- [ ] Verify trigger `trg_inventory_items_updated_at` created

### Code Deployment
- [ ] Pull latest from `v0/anthora-6b40ffce` branch
- [ ] Verify all 11 component files in `app/(dashboard)/stocks/components/`
- [ ] Verify main page `app/(dashboard)/stocks/page.tsx`
- [ ] Verify `lib/stock-integration.ts`
- [ ] Verify sidebar updated with Inventory link in `components/app-sidebar.tsx`
- [ ] Run type check: `npm run build` (or `pnpm build`)
- [ ] No TypeScript errors

## Production Deployment

### Before Going Live
- [ ] Test in staging environment
- [ ] Verify all dashboard metrics load
- [ ] Test Add/Edit/Delete for items, categories, suppliers
- [ ] Test Stock In/Out operations
- [ ] Test audit ledger visibility
- [ ] Test PDF export
- [ ] Test search and filters
- [ ] Verify service integration if planning to use

### Initial Configuration
- [ ] Create default categories (Filters, Membranes, Pumps, Batteries, etc.)
- [ ] Add suppliers as needed
- [ ] Add initial inventory items
- [ ] Set min/max stock levels appropriately
- [ ] Document for team members

### Post-Deployment Verification
- [ ] Navigation shows "Inventory" link
- [ ] Users can navigate to `/stocks` without errors
- [ ] Dashboard summary loads and shows correct metrics
- [ ] Can create new items
- [ ] Can adjust stock
- [ ] Can view audit log
- [ ] Can export PDF

### Team Training
- [ ] Train administrators on inventory management
- [ ] Train technicians on recording parts during service
- [ ] Document service completion workflow
- [ ] Create FAQ or help guide

## Rollback Plan

If issues occur:
1. Revert code to previous version
2. Clear browser cache
3. Test in different browser
4. Check browser console for errors
5. Check Supabase logs for database errors

Database tables won't be affected by code rollback - data is preserved.

## Monitoring Post-Launch

### Daily
- [ ] Check for error messages in UI
- [ ] Verify stock movements are being recorded
- [ ] Monitor low-stock alerts

### Weekly
- [ ] Review inventory summary
- [ ] Check for unusual stock movements
- [ ] Verify parts recording during services

### Monthly
- [ ] Analyze stock usage patterns
- [ ] Adjust min/max levels if needed
- [ ] Export and review audit reports

## Documentation Links

- **Module README**: `STOCKS_MODULE_README.md`
- **Implementation Summary**: `STOCKS_IMPLEMENTATION_SUMMARY.md`
- **Integration Guide**: `STOCKS_INTEGRATION_GUIDE.md`
- **Database Schema**: `remindi-stocks-schema.sql`

## Support & Troubleshooting

### Common Issues

**Issue**: Dashboard metrics not loading
- **Solution**: Check browser console for errors, verify RLS policies active

**Issue**: Cannot create items
- **Solution**: Check org_id is correctly set, verify user is member of organization

**Issue**: Stock In/Out failing
- **Solution**: Verify item exists, check stock won't go negative, review Supabase logs

**Issue**: Service integration not working
- **Solution**: Verify `deduct_stock_for_service` RPC exists, check service_history_id valid

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA/Tester | | | |
| Product Manager | | | |
| Admin User | | | |

## Notes

- Database schema deployment is one-time only
- Code can be deployed/rolled back independently
- No existing pages were modified (only sidebar)
- All new code follows existing patterns and conventions
- RLS policies ensure data isolation by organization

## Contact

For issues or questions about the Stocks module:
- Check `STOCKS_INTEGRATION_GUIDE.md` for common integration questions
- Review `STOCKS_MODULE_README.md` for feature documentation
- Check browser console and Supabase logs for errors
