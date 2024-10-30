### 1.0.28
* Added properties to schema.js for firmware 042

### 1.0.27
* (Casten, fuchs-1978, dft601) Object not found error #158
* Enabled foreign Object usage; Full Changelog online: https://github.com/MK-2001/ioBroker.go-e/blob/main/docs/CHANGELOG.md; Issue for Object not found.

### 1.0.26
* Added Object solarLoadOnly
* Enabled useage of Foreign Object
* detailes description in documentation with examples
* Added switch to negate given foreign values
* Updated Admin interface to get a more structured view
* Catch Networking errors like DNS, Adapter down, etc.
* added possibility to use v2 api (not fully supported yet)
* Updated FOSS

### 1.0.25
* TempArray resize on FW 054 HW V2; Readme.Adaption; Dependency security updates; Added the options to consider acknowledged value changes of foreign adapters; Added choice of ack of foreign adapters (#125)\\n Minor bug for sentry; Error in tme object; Bug in Sentry. Added Catch.

### 1.0.21
* Dependency updates: axio, sentry
* Temperature array 4 > 6 with HW2 FW 054.
* Removed Bug for an not existing temperature array (#120)

### 1.0.18
* First adaption of V3 hardware from go-e; Added switch to disable writing of the temperatures array; write different amont of temperature sensors; Added addtional attributes to ast; Updated several FOSS libs

### 1.0.17
* Stable Version
* Added switch to disable wrting of the temperatures array.
* Writing different amount of temperature sensors
* Updated ast with new property
* Updaed FOSS

### 1.0.15
* Bug fixes

### 1.0.14
* Enabled Hardware V3

### 1.0.10
* Enabled new Version of hardware updates

### 1.0.9
* Catch warn message in read object
* Added SENTRY to get more details for debbugging
* Only work with JSON compatible answers from your adapter
* Updated writable objects attribut #47 Thanks to GoClyde
* Enabled Sentry for debugging
* Added documentation for API v1 of go-e.co (Unsupported v2, yet)
* Added joi validation to validate response from the hardware adapter
* Update color in settings used a watch on a wrong io-object
* Error handling on status update got improved
* udpate dependencies
* Update validation error
### 1.0.1
* Error in adjustAmpLevelInWatts function
* Wrong date
* reomved endpoint changeAmpLevelInWatts
* bug float to amp/amx (Thanks mr. Dvorak)

### 1.0.0
* Publish the adapter package to ioBroker stable
* Added documentation in ./docs/Readme.md
* added unlock_state for cable management
* added amx for non permanat ampere settings
* fix Issue 17: Some adapters are not sharing the temperatures array (Many thanks to maxe1111)
* added telegram community channel
* fix issue 16: Bug in calculation of loaded_energy_kwh (Many thanks to maxe1111)
* Added all steps from Version 0.0.x
* some additional minor fixes from testing.
* (MK-2001) solved bug in maxWatts feature
* Added debug information on maxWatts Feature
* removed info-level-logging on status query
* Added function adjustAmpLevelInWatts
* Added documentation
* removed synctime bug
* adds loaded_energy_kwh (extra value for dwo for unusual unit)
* adds setAmpLevelToButton for 5 levels
* added led brightness
* (MK-2001) Activated the max Watts Feature
* Added some documentation and NPM Documentations
* Activated gulb for translation to different languages
* (MK-2001) Implemented feature to not update 111 States in paralell
* (MK-2001) Added the feature of Max Watts
* (MK-2001, Trunks1982) solved bug with different names.
* (MK-2001) added requirements to publish the adapter again, enabled new writeable interfaces: Access State (ast), Allow Charging (alw), stop_state: ​Automatische Abschaltung (stp), max_load
* (MK-2001) added requirements to publish the adapter
* (MK-2001) initial release

# Translation
Use https://translator.iobroker.in to translate texts.