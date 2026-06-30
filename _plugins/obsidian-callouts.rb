# Convert Obsidian callout syntax (> [!note] Title) to styled HTML
# Runs as a Jekyll Generator — markdown source stays in Obsidian format.
module Jekyll
  class ObsidianCallouts < Generator
    safe true
    priority :high

    ICONS = {
      'note' => '📝', 'warning' => '⚠️', 'tip' => '💡', 'info' => 'ℹ️',
      'danger' => '🔥', 'example' => '📋', 'abstract' => '📄',
      'todo' => '✅', 'success' => '🎉', 'question' => '❓',
      'failure' => '❌', 'bug' => '🐛', 'quote' => '💬'
    }.freeze

    def generate(site)
      site.posts.docs.each { |doc| doc.content = convert(doc.content) }
      site.pages.each     { |page| page.content = convert(page.content) }
    end

    def convert(markdown)
      lines = markdown.lines
      result = []
      i = 0

      while i < lines.length
        line = lines[i]

        if line =~ /^> \[!(\w+)\]\s*(.*)/
          type = $1
          title = $2.strip
          callout_lines = []
          i += 1

          while i < lines.length
            cur = lines[i]

            if cur =~ /^>/
              # Callout content line — strip the > prefix
              callout_lines << cur.sub(/^> ?/, '')
              i += 1
            elsif cur.strip.start_with?('$$')
              # Display math block inside callout (may not have > prefix)
              callout_lines << cur
              i += 1
              while i < lines.length && !lines[i].strip.start_with?('$$')
                callout_lines << lines[i].sub(/^> ?/, '')
                i += 1
              end
              callout_lines << lines[i] if i < lines.length  # closing $$
              i += 1
            elsif cur.strip.empty? && i + 1 < lines.length
              next_line = lines[i + 1]
              if next_line =~ /^>/ || next_line.strip.start_with?('$$')
                callout_lines << "\n"
                i += 1
              else
                break
              end
            else
              break
            end
          end

          icon = ICONS[type] || '📝'
          result << "\n<div class=\"callout callout-#{type}\" markdown=\"1\">\n"
          result << "**#{icon} #{title}**\n" unless title.empty?
          result << callout_lines.join
          result << "\n</div>\n\n"
        else
          result << line
          i += 1
        end
      end

      result.join
    end
  end
end
