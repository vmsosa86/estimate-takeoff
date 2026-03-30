# Estimate Takeoff V1 User Manual

This guide explains how to use Estimate Takeoff V1 for PDF area takeoff.

## What V1 Does

Estimate Takeoff V1 lets you:

- create projects
- upload PDF plan files
- open PDF pages in the browser
- calibrate each page using feet and inches
- draw polygon areas
- save areas and measurements

V1 is focused on area takeoff only.

It does not include:

- pricing
- quotes
- material lists
- OCR
- AI features
- line, count, or volume tools

## Sign In

If the app is protected, your browser will ask for:

- username
- password

Enter the shared access credentials provided by the administrator.

## Main Screens

V1 has three main work areas:

1. Projects page
2. Project detail page
3. Viewer page

## Projects Page

Use the Projects page to manage takeoff jobs.

You can:

- create a new project
- open an existing project
- rename a project
- delete a project

### Create A Project

1. Open the Projects page.
2. Enter a project name.
3. Click the create button.

Use simple names that will still make sense later, for example:

- `MDC North Campus BLD 8000`
- `Roof Plans`
- `Semiconductor Package Rev 5`

## Project Detail Page

Inside a project, you can:

- update the project name
- upload PDF plan files
- view uploaded files
- open a file in the viewer

### Upload A PDF

1. Open the project.
2. Click `Choose File`.
3. Select a PDF.
4. Click `Upload PDF`.

Notes:

- PDF files only
- large construction plan files are supported
- files are stored on the server disk

If upload fails:

- confirm the file is a valid PDF
- wait for the upload to finish before navigating away
- refresh the page and try again

## Viewer Page

The viewer page is where the takeoff work happens.

Main controls:

- `Select`
- `Calibrate`
- `Draw Area`
- `Delete`
- `Prev`
- `Next`
- `Zoom In`
- `Zoom Out`
- `Fit Width`

The right sidebar shows:

- file info
- current page
- calibration status
- saved areas
- total square feet for the page

## Recommended Workflow

Use this order on each page:

1. Open the correct PDF file
2. Go to the page you want
3. Calibrate the page
4. Draw area polygons
5. Name the saved areas
6. Review the total square footage

## Navigate Pages

To move through the PDF:

- click `Prev` for the previous page
- click `Next` for the next page

The current page number is shown in the toolbar and sidebar.

## Zoom And Fit

Use:

- `Zoom In` to enlarge the page
- `Zoom Out` to reduce the page
- `Fit Width` to fit the page to the available viewer width

If the plan feels too small to click accurately, zoom in first.

## Calibrate A Page

Calibration is saved per page.

That means each PDF page can have its own scale.

### When To Calibrate

Calibrate before trusting any area result.

You can still draw shapes on an uncalibrated page, but area values will not be usable until calibration is saved.

### How To Calibrate

1. Open the page you want to measure.
2. Click `Calibrate`.
3. Click the first point on a known dimension.
4. Click the second point on that same known dimension.
5. In the sidebar, enter the real-world distance:
   - feet
   - inches
6. Click `Save calibration`.

Example:

- known wall length is `11 feet 0.98 inches`
- enter `11` in feet
- enter `0.98` in inches

### Calibration Tips

- use the clearest printed dimension available
- choose points that are far apart for better accuracy
- recalibrate if the result looks wrong
- each page must be calibrated separately

### Recalibrate A Page

To replace the page calibration:

1. Click `Calibrate`
2. Select two new points
3. Enter the new distance
4. Click `Save calibration`

The old calibration for that page will be overwritten.

## Draw An Area

Use `Draw Area` for polygon-based area measurement.

### How To Draw

1. Click `Draw Area`.
2. Click around the area boundary point by point.
3. Double-click to finish the polygon.
4. The shape is saved and appears in the sidebar.

### Naming The Area

After saving a shape:

1. Select the shape
2. Enter or edit its name in the sidebar
3. Click `Rename area`

Suggested names:

- `Living Room`
- `Roof A`
- `Slab 1`
- `Open Office`

## Select And Edit An Area

Use `Select` to work with an existing polygon.

When a shape is selected, you can:

- rename it
- review its measured area
- drag points to adjust the polygon

### Edit Shape Points

1. Click `Select`
2. Click the area polygon
3. Drag the visible points to update the shape

The app recalculates the area after the shape changes.

## Delete An Area

To delete a polygon:

1. Click `Select`
2. Click the area you want to remove
3. Click `Delete`

Be careful: deleting removes the saved shape from that page.

## Understanding Results

Area values are shown in:

- square feet

The sidebar displays:

- each saved area name
- each saved area result
- page total area

Displayed values are rounded to 2 decimals.

## Accuracy Tips

For better results:

- calibrate every page before final measuring
- zoom in when placing points
- use a known printed dimension, not a guessed one
- trace the real boundary carefully
- use more points on irregular shapes
- recheck calibration if results seem too large or too small

## What Saves Automatically

The system stores:

- projects
- uploaded PDF files
- page metadata
- page calibrations
- polygon shapes
- area results

If you refresh the page later, saved work should still be there.

## Known V1 Limits

V1 is desktop-first.

Current limits:

- no real user accounts
- no team collaboration
- no pricing or estimate generation
- no count, line, or volume tools
- no CSV export yet
- no file delete flow yet

## Troubleshooting

### The Browser Asks For Username And Password

This is expected when Basic Auth is enabled.

Use the shared credentials for the deployment.

### The PDF Does Not Upload

- confirm the file is a PDF
- refresh and try again
- confirm the server is still running

### The Page Opens But I Cannot Measure Area

Check whether the page is calibrated.

If the page is not calibrated, the app can save polygons but the area output is not reliable yet.

### The Area Looks Wrong

- recalibrate the page
- use a better known dimension
- zoom in and correct the polygon points

### I Refreshed And Lost My Place

Your saved data should remain, but the viewer may return to a default state such as a page reload.

Reopen the file and continue from the needed page.

## Quick Start

If you just want the fastest way to use V1:

1. Sign in
2. Create a project
3. Upload a PDF
4. Open the file
5. Go to the target page
6. Calibrate the page
7. Draw the area
8. Rename the area
9. Review the total square feet
