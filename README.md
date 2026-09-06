# French Transcript Web App v1 -- User Guide

Link: https://french-transcript.onrender.com/

## Basic Usage

1. Upload your audio or video file in the Upload section.
2. Set "Start transcript from segment" to the segment where you want to start (1 by default).

3. Click Start Transcript.
4. Copy the Python code, open Google Colab, create (or open) any notebook, and paste the code into a cell.

5. In Colab, go to Runtime → Change runtime type → T4 GPU, then run the cell. 
- The model will take a few minutes to initialize. 
- You can return to the web app, but keep the Colab notebook open.

6. Completed transcript segments will appear in the Results section in real time. Once all segments are finished, click Download to get the full transcript.


## If the Process Stops (Reaching Colab GPU usage limit or Any Other Reason)

1. Copy all completed transcript segments from the Results section.
2. Switch to another Google account that still has Google Colab GPU available.
3. Follow the Basic Usage steps again, but set "Start transcript from segment" to the last completed segment before the interruption.


## Notes

- Transcription quality may be lower when the audio contains long silences, loud background noise, or fast and unclear speech.
- If the transcript looks a bit cursed, please blame the background noise, not the model. Humans struggle with it too, and AI is just doing its best.
- For the best results, run the transcript through an LLM afterward to clean up formatting, remove noise, and organize the content before using it.

Huge respect to bofenghuang/whisper-large-v3-french for sharing this model (https://huggingface.co/bofenghuang/whisper-large-v3-french).