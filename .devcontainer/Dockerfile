FROM pandoc/latex:3.2.0-alpine

ARG USERNAME=thomas
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN apk add --no-cache ttf-hack
RUN apk add --no-cache shadow

# Install additional LaTeX packages
RUN tlmgr update --self && tlmgr install \
  algorithmicx \
  algorithms \
  collection-context \
  draftwatermark \
  environ \
  fontsetup \
  hyperxmp \
  latexmk \
  lineno \
  marginnote \
  newcomputermodern \
  orcidlink \
  preprint \
  seqsplit \
  tcolorbox \
  titlesec \
  trimspaces \
  xkeyval \
  xstring


ENV OSFONTDIR=/usr/share/fonts

COPY ./fonts/libre-franklin $OSFONTDIR/libre-franklin

RUN TERM=dumb luaotfload-tool --update \
  && chmod -R o+w /opt/texlive/texdir/texmf-var \
  && apk add --no-cache ttf-opensans \
  && fc-cache -sfv $OSFONTDIR/libre-franklin \
  && mtxrun --generate \
  && mtxrun --script font --reload

# Copy templates, images, and other resources
ARG openjournals_path=/usr/local/share/openjournals
COPY ./resources $openjournals_path
COPY ./data $openjournals_path/data
COPY ./scripts/entrypoint.sh /usr/local/bin/inara

ENV JOURNAL=joss
ENV OPENJOURNALS_PATH=$openjournals_path

# Input is read from `paper.md` by default, but can be overridden. Output is
# written to `paper.pdf`
ENTRYPOINT ["/usr/local/bin/inara"]
CMD ["paper.md"]

# Create the user
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME