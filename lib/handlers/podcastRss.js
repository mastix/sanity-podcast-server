const RSS = require('rss');
const sanityClient = require('@sanity/client');
const cacheHandler = require('../cache/cacheHandler');
const yn = require('yn');

const { podcastFeed } = require('../queries');

module.exports = async (request, h) => {
  const {
    params: {
      projectId = '' || process.env.PROJECT_ID,
      dataset = '' || process.env.DATASET || 'production',
      slug = '' || process.env.SLUG,
    } = {},
  } = request;

  const client = sanityClient({
    projectId: projectId,
    dataset: dataset,
    useCdn: true, // `false` if you want to ensure fresh data
  });

  const query = podcastFeed;
  const generator = `Sanity Podcast Server v${process.env.npm_package_version}`;

  if (yn(process.env.ENABLE_CACHING)) {
    cacheHandler.setClient(client);
    cacheHandler.subscribe();
    // just return it if it has been cached.
    if (await cacheHandler.isCached()) {
      console.log('returning cached feed!');
      const response = h.response(await cacheHandler.getFeed());
      response.type('application/xml');
      return response;
    }
  }

  const data = await client.fetch(query, { slug }).catch(err => console.error(err));
console.log(data);
  const {
    title = '',
    description = '',
    copyright = '',
    language = '',
    link = '',
    feedExplicit = '',
    itunesSubtitle = '',
    itunesAuthor = '',
    itunesSummary = '',
    itunesOwner: { itunesName = '', itunesEmail = '' } = {},
    itunesImage = '',
    itunesCategories: { primary = '', secondary = false, tertiary = false } = {},
    episodes = [],
  } = data;

  // set current build date as pubDate for the whole feed:
  const pubDate = Date.now();
  const ttl = process.env.TTL | 60;

  const feed = new RSS({
    generator,
    title,
    description,
    pubDate,
    ttl,
    site_url: link,
    image_url: itunesImage,
    copyright,
    language,
    categories: [primary, secondary && secondary, tertiary && tertiary],
    custom_namespaces: {
      itunes: 'http://www.itunes.com/dtds/podcast-1.0.dtd',
    },
    custom_elements: [
      { 'itunes:subtitle': itunesSubtitle },
      { 'itunes:explicit': feedExplicit },
      { 'itunes:author': itunesAuthor },
      { 'itunes:summary': itunesSummary || description },
      {
        'itunes:owner': [{ 'itunes:name': itunesName }, { 'itunes:email': itunesEmail }],
      },
      {
        'itunes:image': {
          _attr: {
            href: itunesImage,
          },
        },
      },
      {
        'itunes:category': [
          {
            _attr: {
              text: primary,
            },
          },
          secondary
            ? {
                'itunes:category': [
                  {
                    _attr: {
                      text: secondary,
                    },
                  },
                ],
              }
            : '',
          tertiary
            ? {
                'itunes:category': [
                  {
                    _attr: {
                      text: tertiary,
                    },
                  },
                ],
              }
            : '',
        ],
      },
    ],
  });
  episodes.forEach(
    ({
      guid,
      title,
      description,
      date,
      itunesImageHref,
      enclosureUrl,
      enclosureLength,
      itunesEpisodeType,
      itunesExplicit,
      itunesDuration,
      itunesSummary,
      itunesFeedSubtitle,
    }) => {
      feed.item({
        title,
        guid,
        description,
        date,
        custom_elements: [
          {
            enclosure: [
              {
                _attr: {
                  url: enclosureUrl,
                  length: enclosureLength,
                  type: 'audio/mpeg',
                },
              },
            ],
          },
          { 'itunes:summary': itunesSummary },
          { 'itunes:subtitle': itunesFeedSubtitle },
          { 'itunes:episodeType': itunesEpisodeType },
          { 'itunes:duration': itunesDuration },
          { 'itunes:explicit': itunesExplicit ? 'yes' : 'no' },
          {
            'itunes:image': [
              {
                _attr: {
                  href: itunesImageHref,
                },
              },
            ],
          },
        ],
      });
    }
  );

  const feedXML = feed.xml();

  // If enabled, set up subscriber for changes (i.e. in order to invalidate the redis cache)
  if (yn(process.env.ENABLE_CACHING)) {
    cacheHandler.addFeed(feedXML);
  }

  const response = h.response(feedXML);
  response.type('application/xml');

  return response;
};
