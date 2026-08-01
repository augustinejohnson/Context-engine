const lyrics = "Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.\nTwas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed.";

let lyricsText = lyrics.replace(/\n(Verse|Chorus|Bridge|Pre-Chorus|Tag|Part)/gi, '\n\n$1');
const sections = lyricsText.split(/\n\s*\n/);
console.log("Sections count:", sections.length);
sections.forEach((sec, idx) => {
    console.log(`\n--- Section ${idx + 1} ---`);
    console.log(sec);
});

