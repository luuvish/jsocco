/**
 * **Jsocco** is a quick-and-dirty, hundred-line-long, literate-programming-style
 * documentation generator. It produces HTML
 * that displays your comments alongside your code. Comments are passed through
 * [Markdown](http://daringfireball.net/projects/markdown/syntax), and code is
 * passed through [Pygments](http://pygments.org/) syntax highlighting.
 * This page is the result of running Jsocco against its own source file.
 *
 * If you install Jsocco, you can run it from the command-line:
 *
 *     jsocco src/*.js
 *
 * ...will generate an HTML documentation page for each of the named source files, 
 * with a menu linking to the other pages, saving it into a `docs` folder.
 *
 * The [source for Jsocco](http://github.com/luuvish/jsocco) is available on GitHub,
 * and released under the MIT license.
 *
 * To install Jsocco, first make sure you have [Node.js](http://nodejs.org/) and
 * [Pygments](http://pygments.org/) (install the latest dev version of Pygments
 * from [its Mercurial repo](http://dev.pocoo.org/hg/pygments-main)).
 * Then, with NPM:
 *
 *     sudo npm install -g jsocco
 *
 * Jsocco can be used to process CoffeeScript, JavaScript, Ruby, Python, or TeX files.
 * Both single-line comments and block comments are processed.
 *
 * ### Partners in Crime:
 *
 * * If **Node.js** doesn't run on your platform, or you'd prefer a more 
 * convenient package, get [Ryan Tomayko](http://github.com/rtomayko)'s 
 * [Rocco](http://rtomayko.github.com/rocco/rocco.html), the Ruby port that's 
 * available as a gem. 
 * 
 * * If you're writing shell scripts, try
 * [Shocco](http://rtomayko.github.com/shocco/), a port for the **POSIX shell**,
 * also by Mr. Tomayko.
 * 
 * * If Python's more your speed, take a look at 
 * [Nick Fitzgerald](http://github.com/fitzgen)'s [Pycco](http://fitzgen.github.com/pycco/). 
 *
 * * For **Clojure** fans, [Fogus](http://blog.fogus.me/)'s 
 * [Marginalia](http://fogus.me/fun/marginalia/) is a bit of a departure from 
 * "quick-and-dirty", but it'll get the job done.
 *
 * * **Lua** enthusiasts can get their fix with 
 * [Robert Gieseke](https://github.com/rgieseke)'s [Locco](http://rgieseke.github.com/locco/).
 * 
 * * And if you happen to be a **.NET**
 * aficionado, check out [Don Wilson](https://github.com/dontangg)'s 
 * [Nocco](http://dontangg.github.com/nocco/).
 */

/**
 * ### Main Documentation Generation Functions
 */

/**
 * Generate the documentation for a source file by reading it in, splitting it
 * up into comment/code sections, highlighting them for the appropriate language,
 * and merging them into an HTML template.
 */
var generate_documentation = function (source, callback) {
  fs.readFile(source, 'utf-8', function (error, code) {
    if (error) throw error;
    if (get_language(source).name == 'javascript')
      sections = parse_js(source, code);
    else
      sections = parse(source, code);
    highlight(source, sections, function () {
      generate_html(source, sections);
      callback();
    });
  });
};

/**
 * Given a string of source code, parse out each comment and the code that
 * follows it, and create an individual **section** for it.
 * Sections take the form:
 *
 *     {
 *       docs_text: ...
 *       docs_html: ...
 *       code_text: ...
 *       code_html: ...
 *     }
 */
var parse = function (source, code) {
  var lines    = code.split('\n');
  var sections = [];
  var language = get_language(source);
  var has_code = '';
  var docs_text = '';
  var code_text = '';

  var save = function (docs, code) {
    sections.push({docs_text: docs, code_text: code});
  };

  for (var i = 0, length = lines.length; i < length; i += 1) {
    var line = lines[i];
    if (line.match(language.comment_matcher) && !line.match(language.comment_filter)) {
      if (has_code) {
        save(docs_text, code_text);
        has_code = docs_text = code_text = '';
      }
      docs_text += line.replace(language.comment_matcher, '') + '\n';
    } else {
      has_code = true;
      code_text += line + '\n';
    }
  }
  save(docs_text, code_text);
  return sections;
};

/**
 * This parse_js() function is derived from [Dox](https://github.com/visionmedia/dox.git)  
 * JavaScript multi-line comments and codes are parsed.
 */
var parse_js = function (source, code) {
  var lines    = code.split('\n');
  var sections = [];
  var language = get_language(source);
  var has_code = '';
  var docs_text = '';
  var code_text = '';
  var within = false;
  var ignore = false;

  var save = function (docs, code) {
    sections.push({docs_text: docs, code_text: code});
  };

  for (var i = 0, length = code.length; i < length; i += 1) {
    // start comment
    if (!within && '/' == code[i] && '*' == code[i + 1]) {
      // code following previous comment
      if (has_code) {
        save(docs_text, code_text);
        has_code = docs_text = code_text = '';
      }
      docs_text = '';
      i += 2;
      within = true;
      ignore = '!' == code[i];
    // end comment
    } else if (within && '*' == code[i] && '/' == code[i + 1]) {
      i += 2;
      docs_text = docs_text.replace(/^ *\* ?/gm, '');
      within = ignore = false;
    // buffer comment or code
    } else if (within) {
      docs_text += code[i];
    } else {
      has_code = true;
      code_text += code[i];
    }
  }

  if (within) {
    docs_text = docs_text.replace(/^ *\* ?/gm, '');
  }
  save(docs_text, code_text);
  return sections;
};

/**
 * Highlights a single chunk of CoffeeScript code, using **Pygments** over stdio,
 * and runs the text of its corresponding comment through **Markdown**, using
 * [Showdown.js](http://attacklab.net/showdown/).
 *
 * We process the entire file in a single call to Pygments by inserting little
 * marker comments between each section and then splitting the result string
 * wherever our markers occur.
 */
var highlight = function (source, sections, callback) {
  var language = get_language(source);
  var pygments = spawn('pygmentize',
    ['-l', language.name, '-f', 'html', '-O', 'encoding=utf-8,tabsize=2']);
  var output   = '';

  pygments.stderr.addListener('data', function (error) {
    if (error) console.error(error.toString());
  });

  pygments.stdin.addListener('error', function (error) {
    console.error('Could not use Pygments to highlight the source.');
    process.exit(1);
  });

  pygments.stdout.addListener('data', function (result) {
    if (result) output += result;
  });

  pygments.addListener('exit', function () {
    output = output.replace(highlight_start, '').replace(highlight_end, '');
    var fragments = output.split(language.divider_html);
    for (var i = 0, length = sections.length; i < length; i += 1) {
      var section = sections[i];
      section.code_html = highlight_start + fragments[i] + highlight_end;
      section.docs_html = showdown.makeHtml(section.docs_text);
    }
    callback();
  });

  if (pygments.stdin.writable) {
    pygments.stdin.write(
      sections.map(function (v) { return v.code_text; }).join(language.divider_text));
    pygments.stdin.end();
  }
};

/**
 * Once all of the code is finished highlighting, we can generate the HTML file
 * and write out the documentation. Pass the completed sections into the template
 * found in `vendor/docco.jst`
 */
var generate_html = function (source, sections) {
  var title = path.basename(source);
  var dest  = destination(source);
  var html  = docco_template({
    title: title, sections: sections, sources: sources, path: path, destination: destination
  });
  console.log('docco: ' + source + ' -> ' + dest);
  fs.writeFile(dest, html);
};

/**
 * ### Helpers & Setup
 */

/**
 * Require our external dependencies, including **Showdown.js**
 * (the JavaScript implementation of Markdown).
 */
var fs       = require('fs');
var path     = require('path');
var showdown = require('./../vendor/showdown').Showdown;
var spawn    = require('child_process').spawn;
var exec     = require('child_process').exec;

/**
 * A list of the languages that Jsocco supports, mapping the file extension to
 * the name of the Pygments lexer and the symbol that indicates a comment. To
 * add another language to Jsocco's repertoire, add it here.
 */
var languages = {
  '.coffee': {name: 'coffee-script', symbol: '#'},
  '.js':     {name: 'javascript',    symbol: '//'},
  '.rb':     {name: 'ruby',          symbol: '#'},
  '.py':     {name: 'python',        symbol: '#'},
  '.tex':    {name: 'tex',           symbol: '%'},
  '.latex':  {name: 'tex',           symbol: '%'}
};

/**
 * Build out the appropriate matchers and delimiters for each language.
 */
for (var ext in languages) {
  var l = languages[ext];

  /**
   * Does the line begin with a comment?
   */
  l.comment_matcher = new RegExp('^\\s*' + l.symbol + '\\s?');

  /**
   * Ignore [hashbangs](http://en.wikipedia.org/wiki/Shebang_(Unix\))
   * and interpolations...
   */
  l.comment_filter = new RegExp('(^#![/]|^\\s*#\\{)');

  /**
   * The dividing token we feed into Pygments, to delimit the boundaries between
   * sections.
   */
  l.divider_text = '\n' + l.symbol + 'DIVIDER\n';

  /**
   * The mirror of `divider_text` that we expect Pygments to return. We can split
   * on this to recover the original sections.
   * Note: the class is "c" for Python and "c1" for the other languages
   */
  l.divider_html = new RegExp('\\n*<span class="c1?">' + l.symbol + 'DIVIDER<\\/span>\\n*');
}

/**
 * Get the current language we're documenting, based on the extension.
 */
var get_language = function (source) { return languages[path.extname(source)]; };

/**
 * Compute the destination HTML path for an input source file path. If the source
 * is `lib/example.js`, the HTML will be at `docs/example.html`
 */
var destination = function (filepath) {
  return 'docs/' + path.basename(filepath, path.extname(filepath)) + '.html';
};

/**
 * Ensure that the destination directory exists.
 */
var ensure_directory = function (dir, callback) {
  exec('mkdir -p ' + dir, function () { callback(); });
};

/**
 * Micro-templating, originally by John Resig, borrowed by way of
 * [Underscore.js](http://documentcloud.github.com/underscore/).
 */
var template = function (str) {
  return new Function('obj',
    'var p=[],print=function(){p.push.apply(p,arguments);};' +
    'with(obj){p.push(\'' +
    str.replace(/[\r\t\n]/g, " ")
       .replace(/'(?=[^<]*%>)/g,"\t")
       .split("'").join("\\'")
       .split("\t").join("'")
       .replace(/<%=(.+?)%>/g, "',$1,'")
       .split('<%').join("');")
       .split('%>').join("p.push('") +
    "');}return p.join('');"
  );
};

/**
 * Create the template that we will use to generate the Docco HTML page.
 */
var docco_template  = template(fs.readFileSync(__dirname + '/../vendor/docco.jst').toString());

/**
 * The CSS styles we'd like to apply to the documentation.
 */
var docco_styles    = fs.readFileSync(__dirname + '/../vendor/docco.css').toString();

/**
 * The start of each Pygments highlight block.
 */
var highlight_start = '<div class="highlight"><pre>';

/**
 * The end of each Pygments highlight block.
 */
var highlight_end   = '</pre></div>';

/**
 * Run the script.
 * For each source file passed in as an argument, generate the documentation.
 */
var sources = process.ARGV.sort();
if (sources.length) {
  ensure_directory('docs', function () {
    fs.writeFile('docs/docco.css', docco_styles);
    var files = sources.slice(0);
    var next_file = function () {
      if (files.length) {
        generate_documentation(files.shift(), next_file);
      }
    };
    next_file();
  });
}
