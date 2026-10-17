-- Replace directory logo with a venue photograph; leave custom images alone.
begin;
update public.places set image_url='https://images.mindtrip.ai/restaurants/8bca/98f5/eda7/4ae9/ea1d/533a/2dd6/75ff', image_credit='Photo via Mindtrip' where slug='riwaq' and (image_url is null or image_url='https://www.beirut.com/wp-content/uploads/2023/03/50157.png');
commit;
