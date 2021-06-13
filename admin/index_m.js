// This will be called by the admin adapter when the settings page loads
function load(settings, onChange) {
    // example: select elements with id=key and class=value and insert value
    if (!settings) return;
    $(".value").each(function () {
        let $key = $(this);
        const id = $key.attr('id');
        if ($key.attr('type') === 'checkbox') {
            // do not call onChange direct, because onChange could expect some arguments
            $key.prop('checked', settings[id])
                .on("change", () => onChange());
        } else {
            // do not call onChange direct, because onChange could expect some arguments
            $key.val(settings[id])
                .on("change", () => onChange())
                .on('keyup', () => onChange());
        }
    });
    onChange(false);
    // reinitialize all the Materialize labels on the page if you are dynamically adding inputs:
    if (M) M.updateTextFields();

    // Selection Box added from https://forum.iobroker.net/topic/10186/adapterentwicklung-object-id-baum/6

    $('#solarPowerForeignSearch').click(function () {
        initSelectId(function (sid) {
            sid.selectId("show", $('#solarPowerForeignObjectID').val(), function (newId) {
                if (newId != $('#solarPowerForeignObjectID').val()) {
                    $("#solarPowerForeignObjectID").val(newId);
                    $("#solarPowerLbl").addClass("active ");
                    onChange();
                }
            });
        });
    });
    $('#houseConsumptionForeignSearch').click(function () {
        initSelectId(function (sid) {
            sid.selectId('show', $('#houseConsumptionForeignObjectID').val(), function (newId) {
                if (newId != $('#houseConsumptionForeignObjectID').val()) {
                    $('#houseConsumptionForeignObjectID').val(newId);
                    $("#houseConsumptionLbl").addClass("active ");
                    onChange();
                }
            });
        });
    });
    $('#houseBatteryForeignSearch').click(function () {
        initSelectId(function (sid) {
            sid.selectId('show', $('#houseBatteryForeignObjectID').val(), function (newId) {
                if (newId != $("#houseBatteryForeignObjectID").val()) {
                    $('#houseBatteryForeignObjectID').val(newId);
                    $("#houseBatteryLbl").addClass("active ");
                    onChange();
                }
            });
        });
    });
}

// This will be called by the admin adapter when the user presses the save button
function save(callback) {
    // example: select elements with class=value and build settings object
    var obj = {};
    $('.value').each(function () {
        var $this = $(this);
        if ($this.attr("type") === 'checkbox') {
            obj[$this.attr('id')] = $this.prop('checked');
        } else {
            obj[$this.attr("id")] = $this.val();
        }
    });
    callback(obj);
}

// Selection Box added from https://forum.iobroker.net/topic/10186/adapterentwicklung-object-id-baum/6
let selectId;
function initSelectId (cb) {
    if (selectId) return cb(selectId);
    socket.emit("getObjects", function (err, res) {
        if (!err && res) {
            selectId = $("#dialog-select-member").selectId('init',  {
                noMultiselect: true,
                objects: res,
                imgPath:       '../../lib/css/fancytree/',
                filter:        {type: 'state'},
                name:          'vcard-select-state',
                texts: {
                    select:          _('Select'),
                    cancel:          _('Cancel'),
                    all:             _('All'),
                    id:              _('ID'),
                    name:            _('Name'),
                    role:            _('Role'),
                    room:            _('Room'),
                    value:           _('Value'),
                    selectid:        _('Select ID'),
                    from:            _('From'),
                    lc:              _('Last changed'),
                    ts:              _('Time stamp'),
                    wait:            _('Processing...'),
                    ack:             _('Acknowledged'),
                    selectAll:       _('Select all'),
                    unselectAll:     _('Deselect all'),
                    invertSelection: _('Invert selection')
                },
                columns: ['image', 'name', 'role', 'room']
            });
            cb && cb(selectId);
        }
    });
}
