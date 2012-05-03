Handlebars.registerHelper('date', function(date) {
  if(date) {
    dateObj = new Date(date);
    return Handlebars._escape($.timeago(dateObj));
  }
  return 'N/A';
});

//Markdown handles escapes so shouldn't be an issue
Handlebars.registerHelper('better_markdown_escape', function(string, fn) {
  return better_markdown(string);
});

Handlebars.registerHelper('short_content_escape', function(slug, content, options) {
  renderedContent = content;
  if(content) {
    content = renderedContent.substring(0, 200);
    if(content != renderedContent) {
      content += " <a href=\"/blog/"+slug+"\" >...</a>";
    }
    return better_markdown(content);
  } else {
    return '';
  }
});

Handlebars.registerHelper('disqus_link', function(slug, options) {
  //TODO url escape?
  return '<a href="/blog/'+slug+'#disqus_thread" data-disqus-identifier="/blog/'+slug+'" ></a>';
});

Handlebars.registerHelper('labelify', function(options) {
  label = options.fn(this).replace(/\_/g, ' ');
  return label.charAt(0).toUpperCase() + label.substr(1);
});

Handlebars.registerHelper('better_markdown', function(fn) {
  var input = fn(this);
  return better_markdown(input);
});

function better_markdown(input) {
  var converter = new Showdown.converter();
  ///////
  // Make Markdown *actually* skip over block-level elements when
  // processing a string.
  //
  // Official Markdown doesn't descend into
  // block elements written out as HTML (divs, tables, etc.), BUT
  // it doesn't skip them properly either.  It assumes they are
  // either pretty-printed with their contents indented, or, failing
  // that, it just scans for a close tag with the same name, and takes
  // it regardless of whether it is the right one.  As a hack to work
  // around Markdown's hacks, we find the block-level elements
  // using a proper recursive method and rewrite them to be indented
  // with the final close tag on its own line.
  ///////

  // Open-block tag should be at beginning of line,
  // and not, say, in a string literal in example code, or in a pre block.
  // Tag must be followed by a non-word-char so that we match whole tag, not
  // eg P for PRE.  All regexes we wish to use when scanning must have
  // 'g' flag so that they respect (and set) lastIndex.
  // Assume all tags are lowercase.
  var rOpenBlockTag = /^\s{0,2}<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del)(?=\W)/mg;
  var rTag = /<(\/?\w+)/g;
  var idx = 0;
  var newParts = [];
  var blockBuf = [];
  // helper function to execute regex `r` starting at idx and putting
  // the end index back into idx; accumulate the intervening string
  // into an array; and return the regex's first capturing group.
  var rcall = function(r, inBlock) {
    var lastIndex = idx;
    r.lastIndex = lastIndex;
    var match = r.exec(input);
    var result = null;
    if (! match) {
      idx = input.length;
    } else {
      idx = r.lastIndex;
      result = match[1];
    }
    (inBlock ? blockBuf : newParts).push(input.substring(lastIndex, idx));
    return result;
  };

  var nestedTags = [];
  while (idx < input.length) {
    var blockTag = rcall(rOpenBlockTag, false);
    if (blockTag) {
      nestedTags.push(blockTag);
      while (nestedTags.length) {
        var tag = rcall(rTag, true);
        if (! tag) {
          throw new Error("Expected </"+nestedTags[nestedTags.length-1]+
                          "> but found end of string");
        } else if (tag.charAt(0) === '/') {
          // close tag
          var tagToPop = tag.substring(1);
          var tagPopped = nestedTags.pop();
          if (tagPopped !== tagToPop)
            throw new Error(("Mismatched close tag, expected </"+tagPopped+
                             "> but found </"+tagToPop+">: "+
                             input.substr(idx-50,50)+"{HERE}"+
                             input.substr(idx,50)).replace(/\n/g,'\\n'));
        } else {
          // open tag
          nestedTags.push(tag);
        }
      }
      var newBlock = blockBuf.join('');
      var closeTagLoc = newBlock.lastIndexOf('<');
      var firstMatchingClose = newBlock.indexOf('</'+blockTag+'>');
      var shouldIndent =
            (firstMatchingClose >= 0 && firstMatchingClose < closeTagLoc);
      // Put final close tag at beginning of line, indent other lines if necessary.
      // Not indenting unless necessary saves us from indenting in a <pre> tag.
      var part1 = newBlock.substring(0, closeTagLoc);
      var part2 = newBlock.substring(closeTagLoc);
      if (shouldIndent)
        part1 = part1.replace(/\n/g, '\n  ');
      newBlock = part1 + '\n' + part2;
      newParts.push(newBlock);
      blockBuf.length = 0;
    }
  }

  var newInput = newParts.join('');
  var output = converter.makeHtml(newInput);
  return output;
}
