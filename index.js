const fetch = require("node-fetch");
const cheerio = require("cheerio");
const endpoints = require("./endpoints");

class Anime {
  /**
   * constructor, instantiates the object
   * @param {string} url - the base url to use, default: http://animepill.com
   */
  constructor(url) {
    this.base = url || "http://animepill.com";
  }
  // options can look like this
  // {limit: 50}
  _genOptions(options) {
    let i = 0;
    let res = "";
    for (let opt in options) {
      if (i === 0) {
        res += `?${opt}=${options[opt]}`;
      } else {
        res += `&${opt}=${options[opt]}`;
      }
      i++;
    }
    return res;
  }

  _parsePathParam(path, param) {
    const reg = /{(.*?)}/g; // get the stuff between the {}
    const arr = path.match(reg) || []; // array with the results of the regexp
    for (var i = 0; i < arr.length; i++) {
      let par = param[arr[i].substr(1, arr[i].length-2)];
      if (par) {
        path = path.replace(arr[i], par);
      } else {
        path = path.replace(arr[i], "");
      }
    }

    path = path.replace(/\/\/+/g, "/"); // remove double slashes
    return path;
  }

  _get(path, options, param) {
    return fetch(this.base + this._parsePathParam(path, param) + this._genOptions(options))
      .then(res => res.text())
  }

  _getJson(path, options, param) {
    return fetch(this.base + this._parsePathParam(path, param) + this._genOptions(options))
      .then(res => res.json())
  }

  search(anime) {
    return this._getJson(endpoints.search, {q: anime})
      .then(res => {
        return new Promise((resolve, reject) => {
          const output = [];
          for (let item of res.data) {
            output.push(Object.assign({}, item, {getEpisodes: () => this.getEpisodes(item.slug)}));
          }
          resolve(output);
        });
      });
  }

  getEpisodes(slug) {
    return this._get(endpoints.eps, {}, {slug: slug})
      .then(html => {
        return new Promise((resolve, reject) => {
          try {
            const $ = cheerio.load(html);
            const output = [];
            $(".anime__episodes").children().each((i, elem) => {
              elem = $(elem);
              const href = elem.find("a").attr("href");
              const episode = parseInt(href.substring(href.lastIndexOf("-")+1, href.length)) || 1;
              output.push({
                name: elem.text(),
                href: href,
                episode: episode,
                slug: slug,
                getEpisode: () => this.getEpisode(slug, episode)
              });
            });
            resolve(output);
          } catch (e) {
            reject(e);
          }
        });
      });
  }

  getEpisode(slug, ep) {
    return this._get(endpoints.ep, {}, {slug: slug, episode: ep})
      .then(html => {
        const $ = cheerio.load(html);
        return fetch($("#video-iframe").attr("src"))
          .then(data => data.text())
          .then(html => {
            return new Promise((resolve, reject) => {
              try {
                const searchPart = "<script type='text/javascript'>eval(";
                html = html.substring(html.indexOf(searchPart)+searchPart.length-1, html.length);
                html = html.substring(0, html.indexOf("</script>"));
                html = eval(html);
                html = html.substring(html.indexOf("myVideo.src(")+"myVideo.src(".length, html.length-2);
                resolve(eval(html));
              } catch (e) {
                reject(e);
              }
            });
          })
      });
  }

}

module.exports = Anime;